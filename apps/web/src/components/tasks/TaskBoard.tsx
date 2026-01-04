"use client";

import { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskCard, TaskCardSkeleton, type Task } from "./TaskCard";
import { TaskModal, type TaskFormData } from "./TaskModal";
import { TaskFilters, type TaskFiltersState } from "./TaskFilters";
import { trpc } from "@/lib/trpc/client";

type TaskStatus = Task["status"];
type TaskPriority = Task["priority"];

interface ApiTask {
  id: string;
  applicationId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  assignee: string | null;
  labels: string[] | string | null;
  dueDate: Date | null;
  releaseId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function transformApiTask(apiTask: ApiTask): Task {
  return {
    id: apiTask.id,
    applicationId: apiTask.applicationId,
    title: apiTask.title,
    description: apiTask.description,
    status: apiTask.status as TaskStatus,
    priority: apiTask.priority as TaskPriority,
    assignee: apiTask.assignee,
    labels: Array.isArray(apiTask.labels) 
      ? apiTask.labels 
      : apiTask.labels 
        ? JSON.parse(apiTask.labels) 
        : [],
    dueDate: apiTask.dueDate,
    releaseId: apiTask.releaseId,
    createdAt: apiTask.createdAt,
    updatedAt: apiTask.updatedAt,
  };
}

interface TasksByStatus {
  backlog: Task[];
  todo: Task[];
  in_progress: Task[];
  in_review: Task[];
  done: Task[];
  cancelled: Task[];
}

interface TaskBoardProps {
  applicationId: string;
}

const columns: { id: TaskStatus; title: string; color: string }[] = [
  { id: "backlog", title: "Backlog", color: "bg-gray-500" },
  { id: "todo", title: "To Do", color: "bg-blue-500" },
  { id: "in_progress", title: "In Progress", color: "bg-yellow-500" },
  { id: "in_review", title: "In Review", color: "bg-purple-500" },
  { id: "done", title: "Done", color: "bg-green-500" },
  { id: "cancelled", title: "Cancelled", color: "bg-red-500" },
];

interface KanbanColumnProps {
  id: TaskStatus;
  title: string;
  color: string;
  tasks: Task[];
  onAddTask: () => void;
  onTaskClick: (task: Task) => void;
  isLoading?: boolean;
}

function KanbanColumn({
  id,
  title,
  color,
  tasks,
  onAddTask,
  onTaskClick,
  isLoading,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex flex-col min-w-[300px] max-w-[300px]">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={cn("w-2.5 h-2.5 rounded-full", color)} />
          <h3 className="font-medium text-gray-200">{title}</h3>
          <span className="text-sm text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddTask}
          className="h-7 w-7 p-0 text-gray-500 hover:text-gray-300 hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Column Content */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 bg-gray-900/50 rounded-lg p-2 min-h-[200px] max-h-[calc(100vh-280px)] overflow-y-auto transition-colors",
          isOver && "bg-gray-800/50 ring-2 ring-blue-500/30"
        )}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {isLoading ? (
              <>
                <TaskCardSkeleton />
                <TaskCardSkeleton />
                <TaskCardSkeleton />
              </>
            ) : tasks.length > 0 ? (
              tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => onTaskClick(task)}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <Inbox className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No tasks</p>
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

export function TaskBoard({ applicationId }: TaskBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("backlog");
  const [filters, setFilters] = useState<TaskFiltersState>({
    search: "",
    priority: [],
    assignee: [],
  });

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch tasks by status
  const {
    data: tasksByStatus,
    isLoading,
    refetch,
  } = trpc.tasks.byStatus.useQuery(
    { applicationId },
    {
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  );

  // Mutations
  const createTaskMutation = trpc.tasks.create.useMutation({
    onSuccess: () => {
      refetch();
      setIsModalOpen(false);
      setSelectedTask(null);
    },
  });

  const updateTaskMutation = trpc.tasks.update.useMutation({
    onSuccess: () => {
      refetch();
      setIsModalOpen(false);
      setSelectedTask(null);
    },
  });

  const deleteTaskMutation = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      refetch();
      setIsModalOpen(false);
      setSelectedTask(null);
    },
  });

  const bulkUpdateStatusMutation = trpc.tasks.bulkUpdateStatus.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const filteredTasksByStatus = useMemo(() => {
    if (!tasksByStatus) return null;

    const transformAndFilter = (apiTasks: typeof tasksByStatus.backlog): Task[] => {
      return (apiTasks || [])
        .map(transformApiTask)
        .filter((task) => {
          if (
            filters.search &&
            !task.title.toLowerCase().includes(filters.search.toLowerCase()) &&
            !task.description?.toLowerCase().includes(filters.search.toLowerCase())
          ) {
            return false;
          }

          if (
            filters.priority.length > 0 &&
            (!task.priority || !filters.priority.includes(task.priority))
          ) {
            return false;
          }

          if (
            filters.assignee.length > 0 &&
            (!task.assignee || !filters.assignee.includes(task.assignee))
          ) {
            return false;
          }

          return true;
        });
    };

    return {
      backlog: transformAndFilter(tasksByStatus.backlog),
      todo: transformAndFilter(tasksByStatus.todo),
      in_progress: transformAndFilter(tasksByStatus.in_progress),
      in_review: transformAndFilter(tasksByStatus.in_review),
      done: transformAndFilter(tasksByStatus.done),
      cancelled: transformAndFilter(tasksByStatus.cancelled),
    } as TasksByStatus;
  }, [tasksByStatus, filters]);

  const allAssignees = useMemo(() => {
    if (!tasksByStatus) return [];
    const assignees = new Set<string>();
    Object.values(tasksByStatus).forEach((apiTasks) => {
      (apiTasks || []).forEach((task) => {
        if (task.assignee) assignees.add(task.assignee);
      });
    });
    return Array.from(assignees).sort();
  }, [tasksByStatus]);

  const findTask = (taskId: string): Task | null => {
    if (!tasksByStatus) return null;
    for (const apiTasks of Object.values(tasksByStatus)) {
      const apiTask = (apiTasks || []).find((t) => t.id === taskId);
      if (apiTask) return transformApiTask(apiTask);
    }
    return null;
  };

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const task = findTask(event.active.id as string);
    setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const task = findTask(taskId);
    if (!task) return;

    // Determine target status
    let targetStatus: TaskStatus;
    
    // Check if dropped on a column
    if (columns.some((col) => col.id === over.id)) {
      targetStatus = over.id as TaskStatus;
    } else {
      // Dropped on another task - find its status
      const targetTask = findTask(over.id as string);
      if (!targetTask) return;
      targetStatus = targetTask.status;
    }

    // Only update if status changed
    if (task.status !== targetStatus) {
      bulkUpdateStatusMutation.mutate({
        taskIds: [taskId],
        status: targetStatus,
      });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Optional: Handle real-time preview updates
  };

  // Modal handlers
  const openCreateModal = (status: TaskStatus) => {
    setSelectedTask(null);
    setDefaultStatus(status);
    setIsModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setSelectedTask(task);
    setDefaultStatus(task.status);
    setIsModalOpen(true);
  };

  const handleSave = (data: TaskFormData) => {
    if (selectedTask) {
      // Update existing task
      updateTaskMutation.mutate({
        id: selectedTask.id,
        data: {
          title: data.title,
          description: data.description || undefined,
          status: data.status,
          priority: data.priority,
          assignee: data.assignee || null,
          labels: data.labels,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
        },
      });
    } else {
      // Create new task
      createTaskMutation.mutate({
        applicationId,
        title: data.title,
        description: data.description || undefined,
        status: data.status,
        priority: data.priority || undefined,
        assignee: data.assignee || undefined,
        labels: data.labels,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      });
    }
  };

  const handleDelete = (taskId: string) => {
    if (confirm("Are you sure you want to delete this task?")) {
      deleteTaskMutation.mutate(taskId);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <TaskFilters
        filters={filters}
        onFiltersChange={setFilters}
        assignees={allAssignees}
      />

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              id={column.id}
              title={column.title}
              color={column.color}
              tasks={filteredTasksByStatus?.[column.id] || []}
              onAddTask={() => openCreateModal(column.id)}
              onTaskClick={openEditModal}
              isLoading={isLoading}
            />
          ))}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
        </DragOverlay>
      </DndContext>

      {/* Task Modal */}
      <TaskModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        task={selectedTask}
        applicationId={applicationId}
        defaultStatus={defaultStatus}
        onSave={handleSave}
        onDelete={selectedTask ? handleDelete : undefined}
        isLoading={
          createTaskMutation.isPending ||
          updateTaskMutation.isPending ||
          deleteTaskMutation.isPending
        }
      />
    </div>
  );
}
