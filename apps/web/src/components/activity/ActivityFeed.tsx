"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useInView } from "react-intersection-observer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { ActivityEventCard } from "./ActivityEventCard";
import { ActivityFilters } from "./ActivityFilters";
import { ActivityStats } from "./ActivityStats";
import { 
  ActivityEvent, 
  ActivitySource, 
  ActivityCategory, 
  ActivitySeverity,
  ActivityStats as ActivityStatsType,
  ActivityQueryResult,
} from "@/lib/activity/types";

interface ActivityFeedProps {
  initialEvents?: ActivityEvent[];
  showFilters?: boolean;
  showStats?: boolean;
  appId?: string;
  limit?: number;
}

export function ActivityFeed({ 
  initialEvents = [], 
  showFilters = true,
  showStats = true,
  appId,
  limit = 50,
}: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>(initialEvents);
  const [stats, setStats] = useState<ActivityStatsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [newEventsCount, setNewEventsCount] = useState(0);
  
  // Filters
  const [selectedSources, setSelectedSources] = useState<ActivitySource[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<ActivityCategory[]>([]);
  const [selectedSeverities, setSelectedSeverities] = useState<ActivitySeverity[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pendingEventsRef = useRef<ActivityEvent[]>([]);

  // Infinite scroll trigger
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: "100px",
  });

  // Build query params
  const buildQueryParams = useCallback((extraOffset = 0) => {
    const params = new URLSearchParams();
    if (selectedSources.length > 0) params.set("sources", selectedSources.join(","));
    if (selectedCategories.length > 0) params.set("categories", selectedCategories.join(","));
    if (selectedSeverities.length > 0) params.set("severities", selectedSeverities.join(","));
    if (appId) params.set("appIds", appId);
    params.set("limit", limit.toString());
    params.set("offset", (offset + extraOffset).toString());
    return params.toString();
  }, [selectedSources, selectedCategories, selectedSeverities, appId, limit, offset]);

  // Fetch events
  const fetchEvents = useCallback(async (reset = false) => {
    try {
      if (reset) {
        setIsLoading(true);
        setOffset(0);
      }
      
      const queryParams = reset ? 
        new URLSearchParams({
          sources: selectedSources.join(","),
          categories: selectedCategories.join(","),
          severities: selectedSeverities.join(","),
          ...(appId && { appIds: appId }),
          limit: limit.toString(),
          offset: "0",
        }).toString() :
        buildQueryParams();

      const response = await fetch(`/api/activity?${queryParams}`);
      if (!response.ok) throw new Error("Failed to fetch events");
      
      const data: ActivityQueryResult = await response.json();
      
      if (reset) {
        setEvents(data.events);
      } else {
        setEvents(prev => [...prev, ...data.events]);
      }
      
      setHasMore(data.hasMore);
      if (data.nextOffset) setOffset(data.nextOffset);
      
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [buildQueryParams, selectedSources, selectedCategories, selectedSeverities, appId, limit]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!showStats) return;
    try {
      const response = await fetch("/api/activity?action=stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, [showStats]);

  // Load more when scrolling
  useEffect(() => {
    if (inView && hasMore && !isLoading && !isLoadingMore) {
      setIsLoadingMore(true);
      fetchEvents(false);
    }
  }, [inView, hasMore, isLoading, isLoadingMore, fetchEvents]);

  // Initial fetch and reset when filters change
  useEffect(() => {
    fetchEvents(true);
    fetchStats();
  }, [selectedSources, selectedCategories, selectedSeverities]);

  // Setup SSE connection for real-time updates
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedSources.length > 0) params.set("sources", selectedSources.join(","));
    if (selectedCategories.length > 0) params.set("categories", selectedCategories.join(","));
    if (selectedSeverities.length > 0) params.set("severities", selectedSeverities.join(","));
    if (appId) params.set("appIds", appId);

    const eventSource = new EventSource(`/api/activity/stream?${params.toString()}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        
        if (data.type === "connected" || data.type === "heartbeat") {
          setIsConnected(true);
          return;
        }
        
        if (data.type === "event" && data.event) {
          // Convert timestamp string back to Date
          const event = {
            ...data.event,
            timestamp: new Date(data.event.timestamp),
          };
          
          // Add to pending events
          pendingEventsRef.current.unshift(event);
          setNewEventsCount(prev => prev + 1);
        }
      } catch (error) {
        console.error("Error parsing SSE message:", error);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [selectedSources, selectedCategories, selectedSeverities, appId]);

  // Show new events
  const showNewEvents = () => {
    setEvents(prev => [...pendingEventsRef.current, ...prev]);
    pendingEventsRef.current = [];
    setNewEventsCount(0);
  };

  // Clear filters
  const clearFilters = () => {
    setSelectedSources([]);
    setSelectedCategories([]);
    setSelectedSeverities([]);
  };

  // Refresh
  const handleRefresh = () => {
    pendingEventsRef.current = [];
    setNewEventsCount(0);
    fetchEvents(true);
    fetchStats();
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      {showStats && <ActivityStats stats={stats} isLoading={isLoading} />}

      {/* Main content */}
      <div className="flex gap-6">
        {/* Filters sidebar */}
        {showFilters && (
          <Card className="w-64 p-4 flex-shrink-0 h-fit sticky top-4">
            <ActivityFilters
              selectedSources={selectedSources}
              selectedCategories={selectedCategories}
              selectedSeverities={selectedSeverities}
              onSourcesChange={setSelectedSources}
              onCategoriesChange={setSelectedCategories}
              onSeveritiesChange={setSelectedSeverities}
              onClear={clearFilters}
            />
          </Card>
        )}

        {/* Events list */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Activity Feed</h2>
              <Badge variant={isConnected ? "success" : "outline"} className="flex items-center gap-1">
                {isConnected ? (
                  <>
                    <Wifi className="h-3 w-3" />
                    Live
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3" />
                    Offline
                  </>
                )}
              </Badge>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* New events indicator */}
          {newEventsCount > 0 && (
            <Button
              variant="default"
              size="sm"
              className="w-full mb-4"
              onClick={showNewEvents}
            >
              Show {newEventsCount} new event{newEventsCount !== 1 ? "s" : ""}
            </Button>
          )}

          {/* Events */}
          <Card className="divide-y divide-gray-800">
            {isLoading && events.length === 0 ? (
              <div className="p-8 text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">Loading activity...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-400">No activity events found</p>
                <p className="text-sm text-gray-500 mt-1">
                  Events will appear here as they happen
                </p>
              </div>
            ) : (
              <>
                {events.map(event => (
                  <ActivityEventCard key={event.id} event={event} />
                ))}
                
                {/* Load more trigger */}
                <div ref={loadMoreRef} className="p-4">
                  {isLoadingMore && (
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading more...</span>
                    </div>
                  )}
                  {!hasMore && events.length > 0 && (
                    <p className="text-center text-sm text-gray-500">
                      No more events to load
                    </p>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
