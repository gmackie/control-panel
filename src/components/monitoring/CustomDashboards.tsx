"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { 
  LayoutDashboard,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Settings,
  Copy,
  Share,
  Download,
  Upload,
  RefreshCw,
  Move,
  Maximize2,
  BarChart3,
  LineChart,
  PieChart,
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  Server,
  Database,
  Globe,
  Users,
  AlertTriangle,
  CheckCircle,
  Target,
  Heart,
  Cpu,
  HardDrive,
  Network,
  Shield,
  GitBranch,
  Package,
  Bell,
  Search,
  Filter,
  Calendar,
  Layers,
  Grid,
  Maximize,
  Minimize
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'alert' | 'status' | 'gauge';
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  config: {
    dataSource: string;
    metric?: string;
    timeRange?: string;
    aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
    chartType?: 'line' | 'bar' | 'pie' | 'area';
    thresholds?: { warning: number; critical: number };
    refreshInterval?: number;
    filters?: Record<string, any>;
  };
  data?: any;
  visible: boolean;
  lastUpdated: Date;
}

interface CustomDashboard {
  id: string;
  name: string;
  description: string;
  owner: string;
  shared: boolean;
  widgets: DashboardWidget[];
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  template: boolean;
}

interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  category: 'infrastructure' | 'application' | 'business' | 'security';
  widgets: Omit<DashboardWidget, 'id' | 'lastUpdated'>[];
  preview?: string;
}

export function CustomDashboards() {
  const [dashboards, setDashboards] = useState<CustomDashboard[]>([]);
  const [selectedDashboard, setSelectedDashboard] = useState<CustomDashboard | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Mock data generation
  const generateMockDashboards = useCallback((): CustomDashboard[] => {
    const now = new Date();
    return [
      {
        id: 'dash-1',
        name: 'Infrastructure Overview',
        description: 'High-level view of infrastructure health and performance',
        owner: 'admin@gmac.io',
        shared: true,
        widgets: generateMockWidgets('infrastructure'),
        createdAt: new Date(now.getTime() - 86400000 * 7),
        updatedAt: new Date(now.getTime() - 3600000),
        tags: ['infrastructure', 'kubernetes', 'monitoring'],
        template: false
      },
      {
        id: 'dash-2',
        name: 'Application Performance',
        description: 'Application metrics and performance monitoring',
        owner: 'admin@gmac.io',
        shared: false,
        widgets: generateMockWidgets('application'),
        createdAt: new Date(now.getTime() - 86400000 * 3),
        updatedAt: new Date(now.getTime() - 1800000),
        tags: ['application', 'performance', 'apm'],
        template: false
      },
      {
        id: 'dash-3',
        name: 'Security Dashboard',
        description: 'Security alerts, threats, and compliance monitoring',
        owner: 'security@gmac.io',
        shared: true,
        widgets: generateMockWidgets('security'),
        createdAt: new Date(now.getTime() - 86400000 * 1),
        updatedAt: new Date(now.getTime() - 900000),
        tags: ['security', 'alerts', 'compliance'],
        template: false
      }
    ];
  }, []);

  const generateMockWidgets = (category: string): DashboardWidget[] => {
    const now = new Date();
    const baseWidgets: DashboardWidget[] = [];

    if (category === 'infrastructure') {
      baseWidgets.push(
        {
          id: 'widget-cpu',
          type: 'gauge',
          title: 'CPU Usage',
          position: { x: 0, y: 0 },
          size: { width: 4, height: 3 },
          config: {
            dataSource: 'prometheus',
            metric: 'cpu_usage_percent',
            timeRange: '1h',
            thresholds: { warning: 80, critical: 90 },
            refreshInterval: 30
          },
          data: { value: 68.5, status: 'healthy' },
          visible: true,
          lastUpdated: now
        },
        {
          id: 'widget-memory',
          type: 'gauge',
          title: 'Memory Usage',
          position: { x: 4, y: 0 },
          size: { width: 4, height: 3 },
          config: {
            dataSource: 'prometheus',
            metric: 'memory_usage_percent',
            timeRange: '1h',
            thresholds: { warning: 80, critical: 90 },
            refreshInterval: 30
          },
          data: { value: 76.2, status: 'healthy' },
          visible: true,
          lastUpdated: now
        },
        {
          id: 'widget-pods',
          type: 'chart',
          title: 'Pod Status Over Time',
          position: { x: 0, y: 3 },
          size: { width: 8, height: 4 },
          config: {
            dataSource: 'kubernetes',
            metric: 'pod_status',
            timeRange: '24h',
            chartType: 'area',
            refreshInterval: 60
          },
          data: { series: [], status: 'healthy' },
          visible: true,
          lastUpdated: now
        }
      );
    }

    if (category === 'application') {
      baseWidgets.push(
        {
          id: 'widget-response-time',
          type: 'chart',
          title: 'Response Time Trends',
          position: { x: 0, y: 0 },
          size: { width: 6, height: 4 },
          config: {
            dataSource: 'apm',
            metric: 'response_time',
            timeRange: '6h',
            chartType: 'line',
            refreshInterval: 30
          },
          data: { value: 142, trend: 'down' },
          visible: true,
          lastUpdated: now
        },
        {
          id: 'widget-error-rate',
          type: 'metric',
          title: 'Error Rate',
          position: { x: 6, y: 0 },
          size: { width: 2, height: 2 },
          config: {
            dataSource: 'apm',
            metric: 'error_rate',
            timeRange: '1h',
            thresholds: { warning: 2, critical: 5 },
            refreshInterval: 30
          },
          data: { value: 0.8, status: 'healthy' },
          visible: true,
          lastUpdated: now
        }
      );
    }

    if (category === 'security') {
      baseWidgets.push(
        {
          id: 'widget-alerts',
          type: 'table',
          title: 'Security Alerts',
          position: { x: 0, y: 0 },
          size: { width: 8, height: 4 },
          config: {
            dataSource: 'security',
            metric: 'active_alerts',
            timeRange: '24h',
            refreshInterval: 60
          },
          data: { alerts: [], count: 3 },
          visible: true,
          lastUpdated: now
        }
      );
    }

    return baseWidgets;
  };

  const dashboardTemplates: DashboardTemplate[] = [
    {
      id: 'template-infra',
      name: 'Infrastructure Monitoring',
      description: 'Complete infrastructure monitoring with K8s, resource usage, and service health',
      category: 'infrastructure',
      widgets: generateMockWidgets('infrastructure').map(w => ({ ...w, id: undefined, lastUpdated: undefined }) as any)
    },
    {
      id: 'template-app',
      name: 'Application Performance',
      description: 'Application performance metrics, traces, and user experience monitoring',
      category: 'application',
      widgets: generateMockWidgets('application').map(w => ({ ...w, id: undefined, lastUpdated: undefined }) as any)
    },
    {
      id: 'template-security',
      name: 'Security Overview',
      description: 'Security alerts, threat detection, and compliance monitoring',
      category: 'security',
      widgets: generateMockWidgets('security').map(w => ({ ...w, id: undefined, lastUpdated: undefined }) as any)
    }
  ];

  useEffect(() => {
    setDashboards(generateMockDashboards());
  }, [generateMockDashboards]);

  const filteredDashboards = dashboards.filter(dashboard => {
    const matchesSearch = searchQuery === "" || 
      dashboard.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dashboard.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dashboard.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === "all" || 
      dashboard.tags.some(tag => tag === selectedCategory);
    
    return matchesSearch && matchesCategory;
  });

  const createDashboard = (template?: DashboardTemplate) => {
    const now = new Date();
    const newDashboard: CustomDashboard = {
      id: `dash-${Date.now()}`,
      name: template ? `${template.name} Copy` : 'New Dashboard',
      description: template?.description || 'Custom dashboard',
      owner: 'admin@gmac.io',
      shared: false,
      widgets: template ? template.widgets.map(w => ({
        ...w,
        id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        lastUpdated: now
      })) : [],
      createdAt: now,
      updatedAt: now,
      tags: template ? [template.category] : [],
      template: false
    };

    setDashboards([...dashboards, newDashboard]);
    setSelectedDashboard(newDashboard);
    setIsEditing(true);
    setShowTemplates(false);
  };

  const duplicateDashboard = (dashboard: CustomDashboard) => {
    const now = new Date();
    const newDashboard: CustomDashboard = {
      ...dashboard,
      id: `dash-${Date.now()}`,
      name: `${dashboard.name} Copy`,
      createdAt: now,
      updatedAt: now,
      shared: false
    };

    setDashboards([...dashboards, newDashboard]);
  };

  const deleteDashboard = (dashboardId: string) => {
    setDashboards(dashboards.filter(d => d.id !== dashboardId));
    if (selectedDashboard?.id === dashboardId) {
      setSelectedDashboard(null);
    }
  };

  const getWidgetIcon = (type: string) => {
    switch (type) {
      case 'metric': return <Activity className="h-4 w-4" />;
      case 'chart': return <LineChart className="h-4 w-4" />;
      case 'table': return <Grid className="h-4 w-4" />;
      case 'alert': return <Bell className="h-4 w-4" />;
      case 'status': return <CheckCircle className="h-4 w-4" />;
      case 'gauge': return <Target className="h-4 w-4" />;
      default: return <LayoutDashboard className="h-4 w-4" />;
    }
  };

  const renderWidget = (widget: DashboardWidget) => {
    const widgetClass = `col-span-${widget.size.width} row-span-${widget.size.height}`;
    
    return (
      <Card
        key={widget.id}
        className={`${widgetClass} p-4 ${isEditing ? 'cursor-move hover:shadow-lg' : ''} ${!widget.visible ? 'opacity-50' : ''}`}
        draggable={isEditing}
        onDragStart={() => setDraggedWidget(widget.id)}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {getWidgetIcon(widget.type)}
            <h4 className="font-medium">{widget.title}</h4>
          </div>
          {isEditing && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Toggle widget visibility
                  const updatedDashboard = {
                    ...selectedDashboard!,
                    widgets: selectedDashboard!.widgets.map(w =>
                      w.id === widget.id ? { ...w, visible: !w.visible } : w
                    )
                  };
                  setSelectedDashboard(updatedDashboard);
                }}
              >
                {widget.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </Button>
              <Button variant="ghost" size="sm">
                <Settings className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {widget.type === 'metric' && (
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-400">
                {widget.data?.value || 0}
                {widget.config.metric?.includes('percent') ? '%' : 
                 widget.config.metric?.includes('time') ? 'ms' : ''}
              </p>
              <p className="text-sm text-gray-400">{widget.config.metric}</p>
            </div>
          )}

          {widget.type === 'gauge' && (
            <div className="space-y-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-400">
                  {widget.data?.value || 0}%
                </p>
              </div>
              <Progress value={widget.data?.value || 0} className="h-2" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0</span>
                <span className="text-yellow-500">{widget.config.thresholds?.warning}</span>
                <span className="text-red-500">{widget.config.thresholds?.critical}</span>
              </div>
            </div>
          )}

          {widget.type === 'chart' && (
            <div className="h-32 flex items-center justify-center bg-gray-900/50 rounded">
              <div className="text-center">
                <BarChart3 className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Chart: {widget.config.chartType}</p>
              </div>
            </div>
          )}

          {widget.type === 'table' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm bg-gray-900/50 p-2 rounded">
                <span>Active Alerts</span>
                <Badge variant="error">{widget.data?.count || 0}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm bg-gray-900/50 p-2 rounded">
                <span>Resolved</span>
                <Badge variant="secondary">12</Badge>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Source: {widget.config.dataSource}</span>
            <span>Updated {formatDistanceToNow(widget.lastUpdated, { addSuffix: true })}</span>
          </div>
        </div>
      </Card>
    );
  };

  if (showTemplates) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-purple-500" />
            Dashboard Templates
          </h2>
          <Button variant="outline" onClick={() => setShowTemplates(false)}>
            Back to Dashboards
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboardTemplates.map(template => (
            <Card key={template.id} className="p-6">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">{template.category}</Badge>
                  </div>
                  <h3 className="text-lg font-semibold">{template.name}</h3>
                  <p className="text-sm text-gray-400">{template.description}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-gray-500">Includes:</p>
                  <div className="flex flex-wrap gap-1">
                    {template.widgets.slice(0, 3).map((widget, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {widget.title}
                      </Badge>
                    ))}
                    {template.widgets.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{template.widgets.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  onClick={() => createDashboard(template)}
                >
                  Use Template
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (selectedDashboard) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-purple-500" />
              {selectedDashboard.name}
            </h2>
            <p className="text-gray-400 text-sm">{selectedDashboard.description}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={isEditing ? "default" : "outline"}
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Edit className="h-4 w-4 mr-1" />
              {isEditing ? 'Done' : 'Edit'}
            </Button>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Share className="h-4 w-4 mr-1" />
              Share
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSelectedDashboard(null)}
            >
              Back
            </Button>
          </div>
        </div>

        {isEditing && (
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <h3 className="font-medium">Add Widgets:</h3>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Metric Widget
              </Button>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Chart Widget
              </Button>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Table Widget
              </Button>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Alert Widget
              </Button>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-8 gap-4 auto-rows-fr">
          {selectedDashboard.widgets.map(renderWidget)}
          
          {selectedDashboard.widgets.length === 0 && (
            <div className="col-span-8 row-span-4">
              <Card className="p-8 text-center h-full flex items-center justify-center">
                <div>
                  <LayoutDashboard className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-300 mb-2">Empty Dashboard</h3>
                  <p className="text-gray-500 mb-4">
                    Start building your dashboard by adding widgets or use a template.
                  </p>
                  <div className="flex items-center gap-2 justify-center">
                    <Button onClick={() => setIsEditing(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Widget
                    </Button>
                    <Button variant="outline" onClick={() => setShowTemplates(true)}>
                      Use Template
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-purple-500" />
          Custom Dashboards
        </h2>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)}>
            <Copy className="h-4 w-4 mr-1" />
            Templates
          </Button>
          <Button size="sm" onClick={() => createDashboard()}>
            <Plus className="h-4 w-4 mr-2" />
            New Dashboard
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
            <Input
              placeholder="Search dashboards by name, description, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm"
            >
              <option value="all">All Categories</option>
              <option value="infrastructure">Infrastructure</option>
              <option value="application">Application</option>
              <option value="security">Security</option>
              <option value="business">Business</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDashboards.map(dashboard => (
          <Card 
            key={dashboard.id} 
            className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setSelectedDashboard(dashboard)}
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">{dashboard.name}</h3>
                  <p className="text-sm text-gray-400 mb-3">{dashboard.description}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={dashboard.shared ? "default" : "secondary"}>
                      {dashboard.shared ? 'Shared' : 'Private'}
                    </Badge>
                    {dashboard.template && (
                      <Badge variant="outline">Template</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Widgets</span>
                  <span>{dashboard.widgets.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Owner</span>
                  <span>{dashboard.owner}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Updated</span>
                  <span>{formatDistanceToNow(dashboard.updatedAt, { addSuffix: true })}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {dashboard.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateDashboard(dashboard);
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Share className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteDashboard(dashboard.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredDashboards.length === 0 && (
        <Card className="p-8 text-center">
          <LayoutDashboard className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No Dashboards Found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery || selectedCategory !== 'all' 
              ? 'No dashboards match your current filters. Try adjusting your search criteria.'
              : 'Create your first custom dashboard or start with a template.'
            }
          </p>
          <div className="flex items-center gap-2 justify-center">
            <Button onClick={() => createDashboard()}>
              <Plus className="h-4 w-4 mr-2" />
              Create Dashboard
            </Button>
            <Button variant="outline" onClick={() => setShowTemplates(true)}>
              <Copy className="h-4 w-4 mr-2" />
              Browse Templates
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}