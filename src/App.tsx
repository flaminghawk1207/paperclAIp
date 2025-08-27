import { useState, useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    electronAPI: {
      getClipboard: () => Promise<string>;
      setClipboard: (text: string) => Promise<void>;
      fetchRecent: (limit?: number) => Promise<Array<{ id: number; text: string; created_at: string; tags: string | null }>>;
      searchByTag: (tag: string, limit?: number) => Promise<Array<{ id: number; text: string; created_at: string; tags: string | null }>>;
      onClipboardChange: (callback: (text: string) => void) => () => void;
    };
  }
}

// Custom SVG Icons
const ClipboardIcon = () => (
  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const UploadIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const AlertCircleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const HistoryIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

interface ClipboardItem {
  id: number;
  text: string;
  created_at: string;
  tags?: string | null;
}

export default function App() {
  const [text, setText] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [isPasted, setIsPasted] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [clipboardHistory, setClipboardHistory] = useState<ClipboardItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ClipboardItem[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchSeqRef = useRef(0);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [expandedDropdowns, setExpandedDropdowns] = useState<Set<number>>(new Set());
  const [newContentIndicator, setNewContentIndicator] = useState(false);
  const [lastClipboardText, setLastClipboardText] = useState("");
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true);
  const clipboardChangeUnsubscribe = useRef<(() => void) | null>(null);
  const autoRefreshInterval = useRef<NodeJS.Timeout | null>(null);
  const [copiedItemId, setCopiedItemId] = useState<number | null>(null);

  useEffect(() => {
    setCharCount(text.length);
    setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
  }, [text]);

  const loadClipboardHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      const history = await window.electronAPI.fetchRecent(50);
      setClipboardHistory(history);
    } catch (error) {
      console.error("Failed to load clipboard history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Set up real-time clipboard monitoring
  useEffect(() => {
    if (window.electronAPI.onClipboardChange) {
      clipboardChangeUnsubscribe.current = window.electronAPI.onClipboardChange((newText: string) => {
        if (newText && newText !== lastClipboardText && newText !== text) {
          setLastClipboardText(newText);
          
          // Show new content indicator
          setNewContentIndicator(true);
          
          // Auto-refresh history if enabled
          if (isAutoRefreshEnabled && showHistory) {
            loadClipboardHistory();
          }
          
          // Hide indicator after 3 seconds
          setTimeout(() => setNewContentIndicator(false), 3000);
        }
      });
    }

    return () => {
      if (clipboardChangeUnsubscribe.current) {
        clipboardChangeUnsubscribe.current();
      }
    };
  }, [lastClipboardText, text, isAutoRefreshEnabled, showHistory, loadClipboardHistory]);

  // Set up auto-refresh interval
  useEffect(() => {
    if (isAutoRefreshEnabled && showHistory) {
      autoRefreshInterval.current = setInterval(() => {
        loadClipboardHistory();
      }, 5000); // Refresh every 5 seconds
    } else if (autoRefreshInterval.current) {
      clearInterval(autoRefreshInterval.current);
      autoRefreshInterval.current = null;
    }

    return () => {
      if (autoRefreshInterval.current) {
        clearInterval(autoRefreshInterval.current);
      }
    };
  }, [isAutoRefreshEnabled, showHistory, loadClipboardHistory]);

  const handlePaste = async () => {
    try {
      const clip = await window.electronAPI.getClipboard();
      setText(clip);
      setIsPasted(true);
      setTimeout(() => setIsPasted(false), 2000);
    } catch (error) {
      console.error("Failed to paste from clipboard:", error);
    }
  };

  const handleCopy = async () => {
    try {
      await window.electronAPI.setClipboard(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const handleClear = () => {
    setText("");
    setIsCopied(false);
    setIsPasted(false);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const q = value.trim();
    if (!q) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const mySeq = ++searchSeqRef.current;
    // Debounce ~200ms
    setTimeout(async () => {
      if (mySeq !== searchSeqRef.current) return;
      try {
        const rows = await window.electronAPI.searchByTag(q.toLowerCase(), 100);
        if (mySeq !== searchSeqRef.current) return;
        setSearchResults(rows);
      } catch (err) {
        if (mySeq !== searchSeqRef.current) return;
        console.error("Search failed", err);
        setSearchResults([]);
      } finally {
        if (mySeq === searchSeqRef.current) setIsSearching(false);
      }
    }, 200);
  };

  const handleHistoryToggle = () => {
    if (!showHistory && clipboardHistory.length === 0) {
      loadClipboardHistory();
    }
    setShowHistory(!showHistory);
  };

  const loadItemFromHistory = (item: ClipboardItem) => {
    setText(item.text);
    setShowHistory(false);
  };

  const copyItemText = async (e: React.MouseEvent, item: ClipboardItem) => {
    e.stopPropagation();
    try {
      await window.electronAPI.setClipboard(item.text);
      setCopiedItemId(item.id);
      setTimeout(() => setCopiedItemId((prev) => (prev === item.id ? null : prev)), 1500);
    } catch (error) {
      console.error("Failed to copy item text:", error);
    }
  };

  const toggleAutoRefresh = () => {
    setIsAutoRefreshEnabled(!isAutoRefreshEnabled);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const toggleDropdown = (dropdownIndex: number) => {
    const newExpanded = new Set(expandedDropdowns);
    if (newExpanded.has(dropdownIndex)) {
      newExpanded.delete(dropdownIndex);
    } else {
      newExpanded.add(dropdownIndex);
    }
    setExpandedDropdowns(newExpanded);
  };

  const getDropdownItems = (dropdownIndex: number) => {
    const startIndex = dropdownIndex * 10;
    const endIndex = startIndex + 10;
    return clipboardHistory.slice(startIndex, endIndex);
  };

  const getTotalDropdowns = () => {
    return Math.ceil(clipboardHistory.length / 10);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl mb-4 shadow-lg">
            <ClipboardIcon />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent mb-2">
            PaperclAIp
          </h1>
          <p className="text-gray-600 text-lg">
            Your intelligent clipboard companion
          </p>
          
          {/* New Content Indicator */}
          {newContentIndicator && (
            <div className="mt-4 animate-bounce">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-full shadow-lg">
                <SparklesIcon />
                <span className="font-medium">New content detected!</span>
              </div>
            </div>
          )}
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Spotlight-like Tag Search */}
          <div className="glass-effect rounded-2xl p-3 mb-4">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by tag…"
                className="w-full bg-transparent outline-none text-gray-800 placeholder-gray-400"
              />
              {isSearching && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500"></div>
              )}
            </div>
            {searchQuery && (
              <div className="mt-3 max-h-64 overflow-auto space-y-2">
                {searchResults === null ? null : searchResults.length === 0 ? (
                  <div className="text-sm text-gray-500 px-2 py-1">No results</div>
                ) : (
                  searchResults.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-white/60 rounded-lg border border-white/40 hover:bg-white/80 cursor-pointer"
                      onClick={() => loadItemFromHistory(item)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                          {formatDate(item.created_at)}
                        </div>
                        <div className="text-xs text-gray-500">{item.text.length} chars</div>
                      </div>
                      <div className="text-gray-800 text-sm font-medium">{truncateText(item.text, 100)}</div>
                      {item.tags && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.tags.split(',').slice(0,5).map((tag, idx) => (
                            <span key={idx} className="text-[10px] bg-accent-50 text-accent-700 px-2 py-0.5 rounded-full border border-accent-200">
                              {tag.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Main Content - Centered */}
          <div className="glass-effect rounded-3xl p-8 mb-8 animate-slide-up">
            {/* Text Area */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Content Editor
              </label>
              <textarea
                className="input-field h-48 resize-none text-lg leading-relaxed"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Start typing or paste content from your clipboard..."
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-primary-600">{charCount}</div>
                <div className="text-sm text-gray-600">Characters</div>
              </div>
              <div className="bg-white/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-accent-600">{wordCount}</div>
                <div className="text-sm text-gray-600">Words</div>
              </div>
              <div className="bg-white/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-primary-500">
                  {text.split('\n').length}
                </div>
                <div className="text-sm text-gray-600">Lines</div>
              </div>
              <div className="bg-white/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-accent-500">
                  {Math.ceil(charCount / 5)}
                </div>
                <div className="text-sm text-gray-600">Reading Time</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handlePaste}
                className={`btn-primary flex items-center justify-center gap-2 ${
                  isPasted ? 'bg-green-500 hover:bg-green-600' : ''
                }`}
              >
                {isPasted ? (
                  <>
                    <CheckCircleIcon />
                    Content Pasted!
                  </>
                ) : (
                  <>
                    <UploadIcon />
                    Paste from Clipboard
                  </>
                )}
              </button>

              <button
                onClick={handleCopy}
                disabled={!text.trim()}
                className={`btn-secondary flex items-center justify-center gap-2 ${
                  !text.trim() ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isCopied ? (
                  <>
                    <CheckCircleIcon />
                    Copied!
                  </>
                ) : (
                  <>
                    <CopyIcon />
                    Copy to Clipboard
                  </>
                )}
              </button>

              <button
                onClick={handleClear}
                disabled={!text.trim()}
                className={`bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-medium px-6 py-3 rounded-xl transition-all duration-200 transform hover:scale-105 hover:shadow-lg active:scale-95 flex items-center justify-center gap-2 ${
                  !text.trim() ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <AlertCircleIcon />
                Clear
              </button>
            </div>
          </div>

          {/* History Section - Below and Wider */}
          <div className="glass-effect rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handleHistoryToggle}
                className="flex-1 flex items-center justify-between bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-medium px-4 py-3 rounded-xl transition-all duration-200 mr-3"
              >
                <span className="flex items-center gap-2">
                  <HistoryIcon />
                  Clipboard History
                </span>
                {showHistory ? <ChevronUpIcon /> : <ChevronDownIcon />}
              </button>
              
              {/* Auto-refresh toggle */}
              <button
                onClick={toggleAutoRefresh}
                className={`px-4 py-3 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 ${
                  isAutoRefreshEnabled 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700' 
                    : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white hover:from-gray-500 hover:to-gray-600'
                }`}
                title={isAutoRefreshEnabled ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
              >
                <div className={`w-4 h-4 rounded-full border-2 border-white ${isAutoRefreshEnabled ? 'bg-white' : ''}`}></div>
                <span className="text-sm">Auto</span>
              </button>
            </div>

            {showHistory && (
              <div className="space-y-3">
                {isLoadingHistory ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
                    <p className="text-gray-600 mt-2">Loading history...</p>
                  </div>
                ) : clipboardHistory.length > 0 ? (
                  <>
                    <div className="mb-3 text-center">
                      <div className="inline-flex items-center gap-2 text-sm text-gray-600 bg-white/50 px-3 py-1 rounded-full">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        {isAutoRefreshEnabled ? 'Live updates enabled' : 'Live updates disabled'}
                      </div>
                    </div>
                    {Array.from({ length: getTotalDropdowns() }, (_, dropdownIndex) => {
                      const dropdownItems = getDropdownItems(dropdownIndex);
                      const isExpanded = expandedDropdowns.has(dropdownIndex);
                      const startItem = dropdownIndex * 10 + 1;
                      const endItem = Math.min((dropdownIndex + 1) * 10, clipboardHistory.length);
                      
                      return (
                        <div key={dropdownIndex} className="border border-white/30 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
                          <button
                            onClick={() => toggleDropdown(dropdownIndex)}
                            className="w-full flex items-center justify-between bg-gradient-to-r from-white/70 to-white/50 hover:from-white/80 hover:to-white/60 px-4 py-3 transition-all duration-200 text-left group"
                          >
                            <span className="flex items-center gap-3">
                              <div className="w-6 h-6 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
                                <HistoryIcon />
                              </div>
                              <span className="font-semibold text-gray-700 group-hover:text-gray-900 transition-colors duration-200">
                                Items {startItem}-{endItem} ({dropdownItems.length})
                              </span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                {dropdownItems.length} items
                              </span>
                              {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                            </div>
                          </button>
                          
                          {isExpanded && (
                            <div className="bg-white/40 border-t border-white/30">
                              {dropdownItems.map((item) => (
                                <div
                                  key={item.id}
                                  className="p-4 cursor-pointer hover:bg-white/70 transition-all duration-200 border-b border-white/20 last:border-b-0 group"
                                  onClick={() => loadItemFromHistory(item)}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 mt-1">
                                      <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-accent-400 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                                        <ClipboardIcon />
                                      </div>
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-1 rounded-full">
                                          {formatDate(item.created_at)}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <div className="text-xs text-gray-500">
                                            {item.text.length} chars
                                          </div>
                                          <button
                                            onClick={(e) => copyItemText(e, item)}
                                            className="px-2 py-1 text-xs bg-white/70 hover:bg-white rounded-md border border-white/60 flex items-center gap-1"
                                            title="Copy text"
                                          >
                                            {copiedItemId === item.id ? (
                                              <>
                                                <CheckCircleIcon />
                                                Copied
                                              </>
                                            ) : (
                                              <>
                                                <CopyIcon />
                                                Copy
                                              </>
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                      
                                      <div className="text-gray-800 text-sm leading-relaxed font-medium group-hover:text-gray-900 transition-colors duration-200">
                                        {truncateText(item.text, 80)}
                                      </div>

                                      {item.tags && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {item.tags.split(',').slice(0,5).map((tag, idx) => (
                                            <span key={idx} className="text-xs bg-accent-50 text-accent-700 px-2 py-0.5 rounded-full border border-accent-200">
                                              {tag.trim()}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                      
                                      {item.text.includes('\n') && (
                                        <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                          </svg>
                                          Multi-line content
                                        </div>
                                      )}
                                      
                                      {item.text.length > 80 && (
                                        <div className="mt-2 text-xs text-accent-600 font-medium">
                                          Click to view full content
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <p>No clipboard history found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>Made with ❤️ for better productivity</p>
        </div>
      </div>
    </div>
  );
}