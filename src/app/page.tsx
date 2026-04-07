"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DriveFile, QuizExam } from "@/lib/types";

type ListedFile = DriveFile & { isFolder?: boolean; isZip?: boolean };
type StructuredCommentItem = {
  number: string;
  user: string;
  date: string;
  id: string;
  content: string[];
};

function buildQuickAnswerBadge(commentText: string) {
  const answerCounts = { A: 0, B: 0, C: 0, D: 0 };

  if (!commentText || !commentText.trim()) {
    return "";
  }

  const commentLines = commentText.split("\n");
  let startIndex = 0;

  for (let i = 0; i < commentLines.length; i++) {
    if (commentLines[i].includes("====")) {
      startIndex = i + 1;
      break;
    }
  }

  for (let i = startIndex; i < commentLines.length; i++) {
    const trimmedLine = commentLines[i].trim();
    if (!/^#\d+\s*\|/.test(trimmedLine)) continue;

    for (let j = i + 1; j < Math.min(i + 6, commentLines.length); j++) {
      const checkLine = commentLines[j].trim();
      const answerMatch = checkLine.match(/^[A-D]+$/i);
      if (answerMatch) {
        const answer = checkLine[0].toUpperCase() as "A" | "B" | "C" | "D";
        answerCounts[answer]++;
        break;
      }
    }
  }

  let badgeText = "";
  let maxCount = 0;
  const mostCommonAnswers: string[] = [];

  (["A", "B", "C", "D"] as const).forEach((letter) => {
    if (answerCounts[letter] <= 0) return;
    if (badgeText) badgeText += ", ";
    badgeText += `${letter}: ${answerCounts[letter]}`;

    if (answerCounts[letter] > maxCount) {
      maxCount = answerCounts[letter];
      mostCommonAnswers.length = 0;
      mostCommonAnswers.push(letter);
    } else if (answerCounts[letter] === maxCount) {
      mostCommonAnswers.push(letter);
    }
  });

  if (mostCommonAnswers.length === 1) {
    badgeText += `${badgeText ? ", " : ""}Answer: ${mostCommonAnswers[0]}`;
  }

  return badgeText;
}

type ExamSeasonInfo = {
  season: string;
  year: number;
  order: number;
};

function parseExamSeason(name: string): ExamSeasonInfo {
  const upper = name.toUpperCase();
  const yearMatch = upper.match(/20\d{2}/);
  const year = yearMatch ? Number.parseInt(yearMatch[0], 10) : 0;

  if (upper.includes("SP") || upper.includes("SPRING")) {
    return { season: "Spring", year, order: 1 };
  }
  if (upper.includes("SU") || upper.includes("SUMMER")) {
    return { season: "Summer", year, order: 2 };
  }
  if (upper.includes("FA") || upper.includes("FALL")) {
    return { season: "Fall", year, order: 3 };
  }
  if (upper.includes("WI") || upper.includes("WINTER")) {
    return { season: "Winter", year, order: 4 };
  }

  return {
    season: "Other",
    year,
    order: 999,
  };
}

function groupExamsByYearAndSeason(exams: QuizExam[]) {
  const groups = new Map<
    string,
    {
      year: number;
      season: string;
      order: number;
      exams: { exam: QuizExam; originalIndex: number }[];
    }
  >();

  exams.forEach((exam, originalIndex) => {
    const parsed = parseExamSeason(exam.name);
    const key = `${parsed.year}-${parsed.order}`;

    if (!groups.has(key)) {
      groups.set(key, {
        ...parsed,
        exams: [],
      });
    }

    groups.get(key)?.exams.push({ exam, originalIndex });
  });

  return [...groups.values()]
    .sort((a, b) => {
      if (b.year !== a.year) {
        return b.year - a.year;
      }
      return a.order - b.order;
    })
    .map((group) => ({
      ...group,
      seasonYear: group.year > 0 ? `${group.season} ${group.year}` : "Other",
    }));
}

function parseCommentHtml(text: string) {
  if (!text)
    return <p className="no-comment">No comment available for this question</p>;

  if (text.includes("Media ID:") && text.includes("Source:")) {
    const lines = text.split("\n");
    const metadataHtml: JSX.Element[] = [];
    const commentItems: StructuredCommentItem[] = [];

    let i = 0;
    while (i < lines.length && !lines[i].includes("====")) {
      const line = lines[i].trim();
      let label = "",
        value = "";
      if (line.startsWith("Media ID:")) {
        label = "Media ID:";
        value = line.replace("Media ID:", "").trim();
      } else if (line.startsWith("Source:")) {
        label = "Source:";
        value = line.replace("Source:", "").trim();
      } else if (line.startsWith("Extracted At:")) {
        label = "Extracted At:";
        value = line.replace("Extracted At:", "").trim();
      } else if (line.startsWith("Total Comments:")) {
        label = "Total Comments:";
        value = line.replace("Total Comments:", "").trim();
      }

      if (label) {
        metadataHtml.push(
          <div className="comment-metadata-item" key={label}>
            <span className="comment-metadata-label">{label}</span>
            <span className="comment-metadata-value">
              {label === "Source:" ? (
                <a href={value} target="_blank" rel="noreferrer">
                  {value}
                </a>
              ) : (
                value
              )}
            </span>
          </div>,
        );
      }
      i++;
    }

    if (i < lines.length && lines[i].includes("====")) i++;

    let currentComment: StructuredCommentItem | null = null;
    while (i < lines.length) {
      const line = lines[i].trim();
      if (line.startsWith("#") && line.includes("|")) {
        if (currentComment) commentItems.push(currentComment);
        const parts = line.split("|").map((p) => p.trim());
        const number = parts[0].replace("#", "").trim();
        const userPart = parts.find((p) => p.startsWith("User:"));
        const datePart = parts.find((p) => p.startsWith("Date:"));
        currentComment = {
          number,
          user: userPart ? userPart.replace("User:", "").trim() : "Unknown",
          date: datePart ? datePart.replace("Date:", "").trim() : "",
          id: "",
          content: [],
        };
      } else if (line.startsWith("ID:") && currentComment) {
        currentComment.id = line.replace("ID:", "").trim();
      } else if (line.startsWith("Content:") && currentComment) {
        i++;
        while (i < lines.length && !lines[i].includes("---")) {
          if (lines[i].trim()) currentComment.content.push(lines[i].trim());
          i++;
        }
        i--;
      }
      i++;
    }
    if (currentComment) commentItems.push(currentComment);

    return (
      <>
        <div className="comment-metadata">{metadataHtml}</div>
        {commentItems.map((c, idx) => (
          <div className="comment-item" key={idx}>
            <div className="comment-item-header">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <span className="comment-item-number">#{c.number}</span>
                <span className="comment-item-user">{c.user}</span>
              </div>
              <span className="comment-item-date">{c.date}</span>
            </div>
            <div className="comment-item-content">{c.content.join(" ")}</div>
          </div>
        ))}
      </>
    );
  }

  return (
    <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0 }}>
      {text}
    </pre>
  );
}

function toSafeFileName(raw: string) {
  return raw.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim();
}

export default function HomePage() {
  const [folderId, setFolderId] = useState("");
  const [files, setFiles] = useState<ListedFile[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<
    { id?: string; name: string }[]
  >([{ name: "Drive Dataset" }]);

  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingZip, setLoadingZip] = useState(false);
  const [fileLoadProgress, setFileLoadProgress] = useState(0);
  const [zipLoadProgress, setZipLoadProgress] = useState(0);
  const [fileLoadMessage, setFileLoadMessage] = useState("Loading items from Drive...");
  const [zipLoadMessage, setZipLoadMessage] = useState("Loading exam online (in-memory)...");
  const [error, setError] = useState<string | null>(null);

  const [exams, setExams] = useState<QuizExam[]>([]);
  const [examIndex, setExamIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [completedExams, setCompletedExams] = useState<Set<number>>(new Set());

  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [isMobileExamListOpen, setIsMobileExamListOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [driveSearchInput, setDriveSearchInput] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");

  const [zoomLevel, setZoomLevel] = useState(1);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const imageWrapperRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [isFsCommentVisible, setIsFsCommentVisible] = useState(false);
  const [isCommentPanelVisible, setIsCommentPanelVisible] = useState(true);
  const [quickAnswerEnabled, setQuickAnswerEnabled] = useState(true);
  const [fsZoomLevel, setFsZoomLevel] = useState(1);
  const [fsIsDraggingImage, setFsIsDraggingImage] = useState(false);
  const [fsTranslate, setFsTranslate] = useState({ x: 0, y: 0 });
  const fsImageWrapperRef = useRef<HTMLDivElement | null>(null);
  const fsDragStartRef = useRef({ x: 0, y: 0 });
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const currentExam = exams[examIndex];
  const currentQuestion = currentExam?.questions[questionIndex];
  const groupedExams = useMemo(() => groupExamsByYearAndSeason(exams), [exams]);
  const quickAnswerText = useMemo(
    () => buildQuickAnswerBadge(currentQuestion?.comment || ""),
    [currentQuestion?.comment],
  );

  const resetZoom = useCallback(() => {
    setZoomLevel(1);
    setTranslate({ x: 0, y: 0 });
    setIsDraggingImage(false);
  }, []);

  const clampTranslate = useCallback(
    (x: number, y: number, targetZoom: number) => {
      const container = imageWrapperRef.current;
      if (!container || targetZoom <= 1) {
        return { x: 0, y: 0 };
      }

      const image = container.querySelector("img");
      if (!(image instanceof HTMLImageElement)) {
        return { x, y };
      }

      const naturalWidth = image.naturalWidth || image.width;
      const naturalHeight = image.naturalHeight || image.height;
      if (!naturalWidth || !naturalHeight) {
        return { x, y };
      }

      const baseScale = Math.min(
        1,
        container.clientWidth / naturalWidth,
        container.clientHeight / naturalHeight,
      );

      const displayedWidth = naturalWidth * baseScale * targetZoom;
      const displayedHeight = naturalHeight * baseScale * targetZoom;

      const limitX = Math.max(0, (displayedWidth - container.clientWidth) / 2);
      const limitY = Math.max(0, (displayedHeight - container.clientHeight) / 2);

      return {
        x: Math.min(limitX, Math.max(-limitX, x)),
        y: Math.min(limitY, Math.max(-limitY, y)),
      };
    },
    [],
  );

  useEffect(() => {
    if (isDriveModalOpen && files.length === 0 && breadcrumbs.length === 1) {
      loadFolder(undefined, "Drive Dataset", [{ name: "Drive Dataset" }]);
    }
  }, [isDriveModalOpen, files.length, breadcrumbs.length]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);

    return () => {
      mediaQuery.removeEventListener("change", updateViewport);
    };
  }, []);

  useEffect(() => {
    resetZoom();
  }, [examIndex, questionIndex, currentQuestion?.image, resetZoom]);

  useEffect(() => {
    if (!isDraggingImage) return;

    const handleDragMove = (event: MouseEvent) => {
      const nextX = event.clientX - dragStartRef.current.x;
      const nextY = event.clientY - dragStartRef.current.y;
      setTranslate(clampTranslate(nextX, nextY, zoomLevel));
    };

    const handleDragEnd = () => {
      setIsDraggingImage(false);
    };

    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);

    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
    };
  }, [clampTranslate, isDraggingImage, zoomLevel]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("completedExams");
      setCompletedExams(new Set(saved ? JSON.parse(saved) : []));
    } catch {
      setCompletedExams(new Set());
    }

    try {
      const savedQuickAnswer = localStorage.getItem("quickAnswerBadgeEnabled");
      if (savedQuickAnswer !== null) {
        setQuickAnswerEnabled(JSON.parse(savedQuickAnswer));
      }
    } catch {
      setQuickAnswerEnabled(true);
    }

  }, []);

  useEffect(() => {
    if (!loadingFiles) return;

    const timer = window.setInterval(() => {
      setFileLoadProgress((prev) => {
        if (prev >= 92) return prev;
        if (prev < 40) return Math.min(92, prev + 7);
        if (prev < 70) return Math.min(92, prev + 4);
        return Math.min(92, prev + 2);
      });
    }, 220);

    return () => window.clearInterval(timer);
  }, [loadingFiles]);

  useEffect(() => {
    if (!loadingZip) return;

    const timer = window.setInterval(() => {
      setZipLoadProgress((prev) => {
        if (prev >= 94) return prev;
        if (prev < 50) return Math.min(94, prev + 6);
        if (prev < 80) return Math.min(94, prev + 3);
        return Math.min(94, prev + 1);
      });
    }, 220);

    return () => window.clearInterval(timer);
  }, [loadingZip]);

  useEffect(() => {
    localStorage.setItem("completedExams", JSON.stringify([...completedExams]));
  }, [completedExams]);

  useEffect(() => {
    localStorage.setItem("quickAnswerBadgeEnabled", JSON.stringify(quickAnswerEnabled));
  }, [quickAnswerEnabled]);

  const resetFsZoom = useCallback(() => {
    setFsZoomLevel(1);
    setFsTranslate({ x: 0, y: 0 });
    setFsIsDraggingImage(false);
  }, []);

  const clampFsTranslate = useCallback(
    (x: number, y: number, targetZoom: number) => {
      const container = fsImageWrapperRef.current;
      if (!container || targetZoom <= 1) {
        return { x: 0, y: 0 };
      }

      const image = container.querySelector("img");
      if (!(image instanceof HTMLImageElement)) {
        return { x, y };
      }

      const naturalWidth = image.naturalWidth || image.width;
      const naturalHeight = image.naturalHeight || image.height;
      if (!naturalWidth || !naturalHeight) {
        return { x, y };
      }

      const baseScale = Math.min(
        1,
        container.clientWidth / naturalWidth,
        container.clientHeight / naturalHeight,
      );

      const displayedWidth = naturalWidth * baseScale * targetZoom;
      const displayedHeight = naturalHeight * baseScale * targetZoom;

      const limitX = Math.max(0, (displayedWidth - container.clientWidth) / 2);
      const limitY = Math.max(0, (displayedHeight - container.clientHeight) / 2);

      return {
        x: Math.min(limitX, Math.max(-limitX, x)),
        y: Math.min(limitY, Math.max(-limitY, y)),
      };
    },
    [],
  );

  useEffect(() => {
    if (!isFullscreenOpen) return;
    resetFsZoom();
  }, [examIndex, questionIndex, currentQuestion?.image, isFullscreenOpen, resetFsZoom]);

  useEffect(() => {
    if (!isFullscreenOpen || !fsIsDraggingImage) return;

    const handleDragMove = (event: MouseEvent) => {
      const nextX = event.clientX - fsDragStartRef.current.x;
      const nextY = event.clientY - fsDragStartRef.current.y;
      setFsTranslate(clampFsTranslate(nextX, nextY, fsZoomLevel));
    };

    const handleDragEnd = () => {
      setFsIsDraggingImage(false);
    };

    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);

    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
    };
  }, [clampFsTranslate, fsIsDraggingImage, fsZoomLevel, isFullscreenOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isFullscreenOpen) return;

      if (event.key === "Escape") {
        setIsFullscreenOpen(false);
        return;
      }

      if (!currentExam) return;
      if (currentExam.questions.length <= 1) return;

      if (event.key === "ArrowLeft") {
        setQuestionIndex((prev) =>
          prev <= 0 ? currentExam.questions.length - 1 : prev - 1,
        );
      } else if (event.key === "ArrowRight") {
        setQuestionIndex((prev) =>
          prev >= currentExam.questions.length - 1 ? 0 : prev + 1,
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentExam, isFullscreenOpen]);

  const openFullscreen = useCallback(() => {
    if (!currentQuestion?.image) return;
    setIsFullscreenOpen(true);
    setIsFsCommentVisible(false);
    resetFsZoom();
  }, [currentQuestion?.image, resetFsZoom]);

  const navigateQuestionByDelta = useCallback(
    (delta: number) => {
      const questionCount = currentExam?.questions.length || 0;
      if (questionCount <= 1) return;

      setQuestionIndex((prev) => {
        if (delta < 0) {
          return prev <= 0 ? questionCount - 1 : prev - 1;
        }
        return prev >= questionCount - 1 ? 0 : prev + 1;
      });
    },
    [currentExam?.questions.length],
  );

  function handleQuestionTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 1) return;
    touchStartRef.current = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    };
  }

  function handleQuestionTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (!touchStartRef.current || event.changedTouches.length !== 1) {
      touchStartRef.current = null;
      return;
    }

    const endX = event.changedTouches[0].clientX;
    const endY = event.changedTouches[0].clientY;
    const deltaX = endX - touchStartRef.current.x;
    const deltaY = endY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) {
      return;
    }

    navigateQuestionByDelta(deltaX > 0 ? -1 : 1);
  }

  function handleFsImageWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!currentQuestion?.image) return;
    event.preventDefault();

    setFsZoomLevel((prevZoom) => {
      const delta = event.deltaY * -0.002;
      const nextZoom = Math.min(Math.max(1, prevZoom + delta), 5);
      setFsTranslate((prevTranslate) =>
        nextZoom === 1
          ? { x: 0, y: 0 }
          : clampFsTranslate(prevTranslate.x, prevTranslate.y, nextZoom),
      );
      return nextZoom;
    });
  }

  function handleFsImageMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (fsZoomLevel <= 1) return;
    event.preventDefault();
    fsDragStartRef.current = {
      x: event.clientX - fsTranslate.x,
      y: event.clientY - fsTranslate.y,
    };
    setFsIsDraggingImage(true);
  }

  function handleFsImageDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!currentQuestion?.image) return;

    if (fsZoomLevel > 1) {
      resetFsZoom();
      return;
    }

    const container = fsImageWrapperRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left - rect.width / 2;
    const mouseY = event.clientY - rect.top - rect.height / 2;
    const nextZoom = 2.5;

    setFsZoomLevel(nextZoom);
    setFsTranslate(
      clampFsTranslate(
        -mouseX * (nextZoom - 1),
        -mouseY * (nextZoom - 1),
        nextZoom,
      ),
    );
  }

  function toggleCompletedExam(index: number, checked: boolean) {
    setCompletedExams((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(index);
      } else {
        next.delete(index);
      }
      return next;
    });
  }

  async function loadFolder(
    targetFolderId?: string,
    targetName?: string,
    replaceBreadcrumb?: { id?: string; name: string }[],
    searchQuery?: string,
  ) {
    setLoadingFiles(true);
    setFileLoadProgress(8);
    setFileLoadMessage(
      searchQuery?.trim()
        ? "Searching in Drive folders..."
        : "Loading items from Drive...",
    );
    setError(null);

    try {
      const params = new URLSearchParams();
      if (targetFolderId) {
        params.set("folderId", targetFolderId);
      }

      const normalizedSearch = searchQuery?.trim();
      if (normalizedSearch) {
        params.set("search", normalizedSearch);
      }

      const query = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/drive/list${query}`);
      setFileLoadProgress(48);
      const json = (await res.json()) as {
        folderId?: string;
        files?: ListedFile[];
        error?: string;
      };

      if (!res.ok || json.error) {
        throw new Error(json.error || "Failed to load drive files");
      }

      setFolderId(json.folderId || targetFolderId || "");
      setFiles(json.files || []);
      setFileLoadProgress(100);

      if (replaceBreadcrumb) {
        setBreadcrumbs(replaceBreadcrumb);
      } else if (targetName && targetFolderId) {
        setBreadcrumbs((prev) => [
          ...prev,
          { id: targetFolderId, name: targetName },
        ]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoadingFiles(false);
      window.setTimeout(() => {
        setFileLoadProgress(0);
      }, 350);
    }
  }

  function handleBreadcrumbClick(index: number) {
    if (index === breadcrumbs.length - 1) return;
    const targetCrumb = breadcrumbs[index];
    const newBreadcrumb = breadcrumbs.slice(0, index + 1);
    loadFolder(
      targetCrumb.id,
      targetCrumb.name,
      newBreadcrumb,
      activeSearchQuery || undefined,
    );
  }

  function handleImageWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!currentQuestion?.image) return;
    event.preventDefault();

    setZoomLevel((prevZoom) => {
      const delta = event.deltaY * -0.002;
      const nextZoom = Math.min(Math.max(1, prevZoom + delta), 5);
      setTranslate((prevTranslate) =>
        nextZoom === 1
          ? { x: 0, y: 0 }
          : clampTranslate(prevTranslate.x, prevTranslate.y, nextZoom),
      );
      return nextZoom;
    });
  }

  function handleImageMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (zoomLevel <= 1) return;
    event.preventDefault();
    dragStartRef.current = {
      x: event.clientX - translate.x,
      y: event.clientY - translate.y,
    };
    setIsDraggingImage(true);
  }

  function handleImageDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!currentQuestion?.image) return;

    if (zoomLevel > 1) {
      resetZoom();
      return;
    }

    const container = imageWrapperRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left - rect.width / 2;
    const mouseY = event.clientY - rect.top - rect.height / 2;

    const nextZoom = 2.5;
    const targetX = -mouseX * (nextZoom - 1);
    const targetY = -mouseY * (nextZoom - 1);

    setZoomLevel(nextZoom);
    setTranslate(clampTranslate(targetX, targetY, nextZoom));
  }

  function openDriveModal() {
    setDriveSearchInput("");
    setActiveSearchQuery("");
    setError(null);
    setIsDriveModalOpen(true);
  }

  function clearDriveSearch() {
    const currentCrumb = breadcrumbs[breadcrumbs.length - 1] || {
      name: "Drive Dataset",
    };

    setDriveSearchInput("");
    setActiveSearchQuery("");
    loadFolder(currentCrumb.id, currentCrumb.name, [...breadcrumbs]);
  }

  function handleDriveSearch() {
    const query = driveSearchInput.trim();
    const currentCrumb = breadcrumbs[breadcrumbs.length - 1] || {
      name: "Drive Dataset",
    };

    setActiveSearchQuery(query);
    loadFolder(
      currentCrumb.id,
      currentCrumb.name,
      [...breadcrumbs],
      query || undefined,
    );
  }

  async function openZip(file: ListedFile) {
    if (!file.id) return;
    setLoadingZip(true);
    setZipLoadProgress(10);
    setZipLoadMessage("Downloading exam package from Drive...");
    setError(null);

    try {
      const res = await fetch(
        `/api/drive/open-zip?fileId=${encodeURIComponent(file.id)}`,
      );
      setZipLoadProgress(42);
      setZipLoadMessage("Extracting exam data...");
      const json = (await res.json()) as { exams?: QuizExam[]; error?: string };

      if (!res.ok || json.error) {
        throw new Error(json.error || "Failed to open ZIP file");
      }

      const data = json.exams || [];
      if (data.length === 0) {
        throw new Error("ZIP has no exam/question data");
      }

      setZipLoadProgress(82);
      setZipLoadMessage("Preparing viewer...");
      setExams(data);
      setExamIndex(0);
      setQuestionIndex(0);
      setZipLoadProgress(100);
      setZipLoadMessage("Done");
      setIsDriveModalOpen(false); // Close modal when ZIP is successfully loaded
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoadingZip(false);
      window.setTimeout(() => {
        setZipLoadProgress(0);
      }, 350);
    }
  }

  function downloadCurrentImage() {
    if (!currentQuestion?.image) {
      return;
    }

    const ext = currentQuestion.image.includes("image/webp")
      ? "webp"
      : currentQuestion.image.includes("image/png")
        ? "png"
        : "jpg";

    const examName = toSafeFileName(currentExam?.name || "exam");
    const fileName = `${examName}-Q${currentQuestion.number}.${ext}`;

    const link = document.createElement("a");
    link.href = currentQuestion.image;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">
            <svg
              className="title-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            FUO Quiz Viewer (Web)
          </h1>
          {exams.length > 0 && isMobileViewport && (
            <button
              type="button"
              className="btn-secondary mobile-exams-toggle"
              onClick={() => setIsMobileExamListOpen((prev) => !prev)}
            >
              {isMobileExamListOpen ? "Hide Exams" : "Show Exams"}
            </button>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={openDriveModal}
          >
            <svg
              className="btn-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
              />
            </svg>
            Browse Exams
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="main-content">
        {/* Sidebar */}
        <aside className={`sidebar ${isMobileExamListOpen ? "mobile-open" : ""}`}>
          <div className="sidebar-header">
            <h2>Exams</h2>
            <span className="count-badge">{exams.length}</span>
          </div>
          <div className="exam-list">
            {exams.length === 0 ? (
              <div className="empty-state">
                <svg
                  className="empty-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <p>No exams loaded</p>
                <p className="empty-hint">
                  Open a Drive folder or ZIP file to get started
                </p>
              </div>
            ) : (
              groupedExams.map((group) => (
                <div
                  key={`${group.year}-${group.order}`}
                  className="exam-season-group"
                >
                  <div className="exam-season-header">{group.seasonYear}</div>
                  {group.exams.map(({ exam, originalIndex }) => (
                    <div
                      key={`${group.seasonYear}-${originalIndex}`}
                      className={`exam-item ${originalIndex === examIndex ? "active" : ""} ${completedExams.has(originalIndex) ? "completed" : ""}`}
                      onClick={() => {
                        setExamIndex(originalIndex);
                        setQuestionIndex(0);
                        if (window.innerWidth <= 900) {
                          setIsMobileExamListOpen(false);
                        }
                      }}
                    >
                      <div className="exam-item-header">
                        <input
                          type="checkbox"
                          className="exam-item-checkbox"
                          checked={completedExams.has(originalIndex)}
                          onChange={(event) =>
                            toggleCompletedExam(originalIndex, event.target.checked)
                          }
                          onClick={(event) => event.stopPropagation()}
                        />
                        <div className="exam-item-name">{exam.name}</div>
                      </div>
                      <div className="exam-item-info">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          ></path>
                        </svg>
                        {exam.questions.length} questions
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Viewer Area */}
        <main className="viewer-area">
          {/* Welcome Screen (shown when no ZIP loaded) */}
          {exams.length === 0 ? (
            <div className="welcome-screen">
              <div className="welcome-content">
                <div
                  className="drop-zone"
                  onClick={() => setIsDriveModalOpen(true)}
                >
                  <svg
                    className="welcome-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <h2>Click to Browse Drive Exams</h2>
                  <p>Or open an extracted exam folder from the menu</p>
                </div>
              </div>
            </div>
          ) : (
            /* Viewer Content (shown when ZIP loaded) */
            <div className="viewer-content">
              {/* Viewer Header */}
              <div className="viewer-header">
                <div className="exam-info">
                  <h2>{currentExam?.name || "Exam Name"}</h2>
                  <span className="count-badge">
                    {currentExam?.questions.length || 0} questions
                  </span>
                </div>
                <div className="question-nav">
                  <button
                    className="btn-nav"
                    disabled={(currentExam?.questions.length || 0) <= 1}
                    onClick={() => navigateQuestionByDelta(-1)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                    Previous
                  </button>
                  <span className="question-indicator">
                    {questionIndex + 1} / {currentExam?.questions.length || 1}
                  </span>
                  <button
                    className="btn-nav"
                    disabled={(currentExam?.questions.length || 0) <= 1}
                    onClick={() => navigateQuestionByDelta(1)}
                  >
                    Next
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>
                <button
                  type="button"
                  className="comment-toggle-btn desktop-comment-toggle"
                  onClick={() => setIsCommentPanelVisible((prev) => !prev)}
                >
                  {isCommentPanelVisible ? "Hide comment" : "Show comment"}
                </button>
                <button
                  type="button"
                  className="comment-toggle-btn"
                  onClick={downloadCurrentImage}
                  disabled={!currentQuestion?.image}
                >
                  Screenshot
                </button>
              </div>

              {/* Question and Comment Container */}
              <div className="question-container">
                <div
                  className={`question-image-wrapper ${zoomLevel > 1 ? "zoomed" : ""} ${isDraggingImage ? "dragging" : ""}`}
                  ref={imageWrapperRef}
                  onWheel={handleImageWheel}
                  onMouseDown={handleImageMouseDown}
                  onDoubleClick={handleImageDoubleClick}
                  onClick={() => {
                    if (!isMobileViewport) {
                      openFullscreen();
                    }
                  }}
                  onTouchStart={handleQuestionTouchStart}
                  onTouchEnd={handleQuestionTouchEnd}
                >
                  {!currentQuestion?.image ? (
                    <div style={{ color: "var(--text-muted)" }}>
                      No image loaded
                    </div>
                  ) : (
                    <img
                      src={currentQuestion.image}
                      alt="Question"
                      className="question-image"
                      draggable={false}
                      title="Click to view fullscreen"
                      style={{
                        transform: `translate(${translate.x}px, ${translate.y}px) scale(${zoomLevel})`,
                        transformOrigin: "center",
                      }}
                    />
                  )}
                </div>
                <div
                  className={`comment-section ${isMobileViewport ? "mobile-visible" : isCommentPanelVisible ? "" : "hidden"}`}
                >
                  <div className="comment-header">
                    <svg
                      className="comment-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                      />
                    </svg>
                    <h3>Comment</h3>
                  </div>
                  <div className="comment-content">
                    {parseCommentHtml(currentQuestion?.comment || "")}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Fullscreen Image Modal */}
      {isFullscreenOpen && currentQuestion?.image && (
        <div className="fullscreen-modal active">
          <div className="fs-container">
            <div className="fs-main-area">
              <button
                type="button"
                className="fs-nav-btn prev"
                disabled={(currentExam?.questions.length || 0) <= 1}
                onClick={() => navigateQuestionByDelta(-1)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              <div
                className={`fs-image-wrapper ${fsIsDraggingImage ? "dragging" : ""}`}
                ref={fsImageWrapperRef}
                onWheel={handleFsImageWheel}
                onMouseDown={handleFsImageMouseDown}
                onDoubleClick={handleFsImageDoubleClick}
                onTouchStart={handleQuestionTouchStart}
                onTouchEnd={handleQuestionTouchEnd}
              >
                <img
                  src={currentQuestion.image}
                  alt="Fullscreen"
                  className="fs-image"
                  draggable={false}
                  style={{
                    transform: `translate(${fsTranslate.x}px, ${fsTranslate.y}px) scale(${fsZoomLevel})`,
                    transformOrigin: "center",
                  }}
                />
                {quickAnswerEnabled && quickAnswerText && (
                  <div
                    className="comment-badge"
                    title="Click to toggle comments"
                    onClick={() => setIsFsCommentVisible((prev) => !prev)}
                  >
                    {quickAnswerText}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="fs-nav-btn next"
                disabled={(currentExam?.questions.length || 0) <= 1}
                onClick={() => navigateQuestionByDelta(1)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>

            <div className={`fs-sidebar ${isFsCommentVisible ? "visible" : ""}`}>
              <div className="fs-sidebar-header">
                <h3>Comments</h3>
              </div>
              <div className="fs-sidebar-content">
                {parseCommentHtml(currentQuestion.comment || "")}
              </div>
            </div>
          </div>

          <div className="fs-controls">
            <div className="fs-indicator">
              {questionIndex + 1} / {currentExam?.questions.length || 1}
            </div>
            <button
              type="button"
              className="fs-control-btn"
              title="Toggle Comments"
              onClick={() => setIsFsCommentVisible((prev) => !prev)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            </button>
            <button
              type="button"
              className={`fs-control-btn ${quickAnswerEnabled ? "active" : ""}`}
              title="Quick Answer Badge"
              onClick={() => setQuickAnswerEnabled((prev) => !prev)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </button>
            <button
              type="button"
              className="fs-control-btn"
              title="Screenshot"
              onClick={downloadCurrentImage}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 7h4l2-2h6l2 2h4v12H3V7zm9 10a4 4 0 100-8 4 4 0 000 8z"
                />
              </svg>
            </button>
            <button
              type="button"
              className="fs-control-btn close"
              title="Close"
              onClick={() => setIsFullscreenOpen(false)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Drive Modal */}
      {isDriveModalOpen && (
        <div className="drive-modal-wrapper">
          <div className="drive-container">
            {/* Drive Header */}
            <div className="drive-header">
              <h2>Exam Explorer</h2>
              <button
                className="drive-close-btn"
                onClick={() => setIsDriveModalOpen(false)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  width="24"
                  height="24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Breadcrumbs */}
            <div className="drive-breadcrumbs">
              {breadcrumbs.map((crumb, idx) => (
                <div
                  key={crumb.id || idx}
                  style={{ display: "flex", alignItems: "center" }}
                >
                  <div
                    className={`breadcrumb-item ${idx === breadcrumbs.length - 1 ? "active" : ""}`}
                    onClick={() => handleBreadcrumbClick(idx)}
                  >
                    {crumb.name}
                  </div>
                  {idx < breadcrumbs.length - 1 && (
                    <span
                      className="breadcrumb-separator"
                      style={{ margin: "0 0.5rem" }}
                    >
                      /
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="drive-search-container">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                className="drive-search-input"
                value={driveSearchInput}
                placeholder="Search files..."
                onChange={(event) => setDriveSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleDriveSearch();
                  }
                }}
              />
              <button
                type="button"
                className="drive-search-btn"
                onClick={handleDriveSearch}
                disabled={loadingFiles || loadingZip}
              >
                Search
              </button>
              {activeSearchQuery && (
                <button
                  type="button"
                  className="drive-search-btn drive-search-clear"
                  onClick={clearDriveSearch}
                  disabled={loadingFiles || loadingZip}
                >
                  Clear
                </button>
              )}
            </div>

            {activeSearchQuery && (
              <div className="drive-active-search">
                <span className="drive-active-search-label">Searching:</span>
                <span className="drive-active-search-keyword">{activeSearchQuery}</span>
                <button
                  type="button"
                  className="drive-active-search-clear"
                  onClick={clearDriveSearch}
                  disabled={loadingFiles || loadingZip}
                >
                  Clear filter
                </button>
              </div>
            )}

            {/* Error Message Container (optional space) */}
            {error && (
              <div
                style={{
                  padding: "0.75rem 2rem",
                  background: "rgba(239, 68, 68, 0.1)",
                  color: "var(--danger)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {error}
              </div>
            )}

            {/* Drive Content */}
            <div className="drive-content" style={{ position: "relative" }}>
              {/* Loading UI exactly like Electron */}
              <div
                className={`drive-loader ${loadingFiles || loadingZip ? "" : "hidden"}`}
              >
                <div className="spinner"></div>
                <p>
                  {loadingZip
                    ? zipLoadMessage
                    : fileLoadMessage}
                </p>
                <div className="drive-progress-wrap">
                  <div
                    className="drive-progress-bar"
                    style={{
                      width: `${loadingZip ? zipLoadProgress : fileLoadProgress}%`,
                    }}
                  />
                </div>
                <span className="drive-progress-value">
                  {Math.max(0, Math.min(100, Math.round(loadingZip ? zipLoadProgress : fileLoadProgress)))}%
                </span>
              </div>

              {files.length === 0 && !loadingFiles && (
                <div
                  style={{
                    textAlign: "center",
                    width: "100%",
                    gridColumn: "1 / -1",
                    color: "var(--text-muted)",
                  }}
                >
                  {activeSearchQuery
                    ? `No result found for "${activeSearchQuery}".`
                    : "No folders or ZIP files found."}
                </div>
              )}

              {files.map((file) => (
                <div
                  key={file.id}
                  className={`drive-item ${file.isFolder ? "folder" : file.isZip ? "zip" : ""}`}
                  onClick={() => {
                    if (file.isFolder) {
                      setDriveSearchInput("");
                      setActiveSearchQuery("");
                      loadFolder(file.id, file.name);
                    }
                    else if (file.isZip) openZip(file);
                  }}
                >
                  <svg
                    className="drive-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    {file.isFolder ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    ) : file.isZip ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    )}
                  </svg>
                  <div className="drive-name">{file.name}</div>
                  <div className="drive-size">
                    {file.isFolder
                      ? "Folder"
                      : file.size
                        ? `${(Number(file.size) / (1024 * 1024)).toFixed(2)} MB`
                        : "Unknown"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
