import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MonitoringDashboard from '../dashboard/monitoring-dashboard'

// Mock recharts
jest.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>
}))

const mockUseQuery = jest.fn()
const mockUseMutation = jest.fn()

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: () => mockUseQuery(),
  useMutation: () => mockUseMutation()
}))

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

const mockMetricsData = {
  timestamp: '2024-01-15T10:00:00Z',
  system: {
    cpu: { usage: 45.2, cores: 8, load: [1.2, 1.1, 0.9] },
    memory: { used: 2048, total: 8192, free: 6144, cached: 1024 },
    disk: { used: 25600, total: 102400, free: 76800, io: { read: 150, write: 200 } },
    network: { rx: 1024000, tx: 512000, connections: 45 }
  },
  applications: {
    gitea: { status: 'healthy', responseTime: 120, uptime: 99.9 },
    drone: { status: 'healthy', responseTime: 85, uptime: 99.5 },
    harbor: { status: 'healthy', responseTime: 200, uptime: 99.8 },
    argocd: { status: 'healthy', responseTime: 95, uptime: 99.7 }
  }
}

const mockAlertsData = {
  alerts: [
    {
      id: '1',
      name: 'High CPU Usage',
      status: 'firing' as const,
      severity: 'high' as const,
      message: 'CPU usage is above 80%',
      labels: { instance: 'node-1', job: 'node-exporter' },
      annotations: { description: 'High CPU usage detected', runbook_url: '' },
      generatorURL: '',
      fingerprint: 'abc123',
      startsAt: '2024-01-15T10:00:00Z',
      endsAt: null,
      updatedAt: '2024-01-15T10:00:00Z'
    }
  ],
  summary: {
    total: 1,
    firing: 1,
    pending: 0,
    resolved: 0,
    mttr: 120
  }
}

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

describe('MonitoringDashboard', () => {
  beforeEach(() => {
    mockUseQuery
      .mockReturnValueOnce({
        data: mockMetricsData,
        isLoading: false,
        error: null,
        refetch: jest.fn()
      })
      .mockReturnValueOnce({
        data: mockAlertsData,
        isLoading: false,
        error: null,
        refetch: jest.fn()
      })

    mockUseMutation.mockReturnValue({
      mutate: jest.fn(),
      isLoading: false,
      error: null
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders monitoring dashboard with metrics and alerts', async () => {
    renderWithQueryClient(<MonitoringDashboard />)

    expect(screen.getByText('Monitoring Dashboard')).toBeInTheDocument()
    expect(screen.getByText('System Metrics')).toBeInTheDocument()
    expect(screen.getByText('Active Alerts')).toBeInTheDocument()
  })

  it('displays CPU metrics correctly', async () => {
    renderWithQueryClient(<MonitoringDashboard />)

    expect(screen.getByText('CPU Usage')).toBeInTheDocument()
    expect(screen.getByText('45.2%')).toBeInTheDocument()
    expect(screen.getByText('8 cores')).toBeInTheDocument()
  })

  it('displays memory metrics correctly', async () => {
    renderWithQueryClient(<MonitoringDashboard />)

    expect(screen.getByText('Memory Usage')).toBeInTheDocument()
    expect(screen.getByText('2.0 GB / 8.0 GB')).toBeInTheDocument()
  })

  it('displays disk metrics correctly', async () => {
    renderWithQueryClient(<MonitoringDashboard />)

    expect(screen.getByText('Disk Usage')).toBeInTheDocument()
    expect(screen.getByText('25.0 GB / 100.0 GB')).toBeInTheDocument()
  })

  it('displays network metrics correctly', async () => {
    renderWithQueryClient(<MonitoringDashboard />)

    expect(screen.getByText('Network Traffic')).toBeInTheDocument()
    expect(screen.getByText('RX: 1.0 MB/s')).toBeInTheDocument()
    expect(screen.getByText('TX: 512.0 KB/s')).toBeInTheDocument()
  })

  it('displays application status correctly', async () => {
    renderWithQueryClient(<MonitoringDashboard />)

    expect(screen.getByText('Application Health')).toBeInTheDocument()
    expect(screen.getByText('Gitea')).toBeInTheDocument()
    expect(screen.getByText('healthy')).toBeInTheDocument()
    expect(screen.getByText('120ms')).toBeInTheDocument()
    expect(screen.getByText('99.9%')).toBeInTheDocument()
  })

  it('displays alerts correctly', async () => {
    renderWithQueryClient(<MonitoringDashboard />)

    expect(screen.getByText('High CPU Usage')).toBeInTheDocument()
    expect(screen.getByText('firing')).toBeInTheDocument()
    expect(screen.getByText('high')).toBeInTheDocument()
    expect(screen.getByText('CPU usage is above 80%')).toBeInTheDocument()
  })

  it('displays alert summary correctly', async () => {
    renderWithQueryClient(<MonitoringDashboard />)

    expect(screen.getByText('Alert Summary')).toBeInTheDocument()
    expect(screen.getByText('Total: 1')).toBeInTheDocument()
    expect(screen.getByText('Firing: 1')).toBeInTheDocument()
    expect(screen.getByText('MTTR: 120 min')).toBeInTheDocument()
  })

  it('renders charts for metrics visualization', async () => {
    renderWithQueryClient(<MonitoringDashboard />)

    expect(screen.getAllByTestId('line-chart')).toHaveLength(4) // CPU, Memory, Disk, Network
    expect(screen.getAllByTestId('responsive-container')).toHaveLength(4)
  })

  it('handles alert acknowledgment', async () => {
    const mockMutate = jest.fn()
    mockUseMutation.mockReturnValue({
      mutate: mockMutate,
      isLoading: false,
      error: null
    })

    renderWithQueryClient(<MonitoringDashboard />)

    const acknowledgeButton = screen.getByRole('button', { name: /acknowledge/i })
    await userEvent.click(acknowledgeButton)

    expect(mockMutate).toHaveBeenCalledWith({
      alertId: '1',
      action: 'acknowledge'
    })
  })

  it('handles alert resolution', async () => {
    const mockMutate = jest.fn()
    mockUseMutation.mockReturnValue({
      mutate: mockMutate,
      isLoading: false,
      error: null
    })

    renderWithQueryClient(<MonitoringDashboard />)

    const resolveButton = screen.getByRole('button', { name: /resolve/i })
    await userEvent.click(resolveButton)

    expect(mockMutate).toHaveBeenCalledWith({
      alertId: '1',
      action: 'resolve'
    })
  })

  it('filters metrics by time range', async () => {
    const mockRefetch = jest.fn()
    mockUseQuery
      .mockReturnValueOnce({
        data: mockMetricsData,
        isLoading: false,
        error: null,
        refetch: mockRefetch
      })
      .mockReturnValueOnce({
        data: mockAlertsData,
        isLoading: false,
        error: null,
        refetch: jest.fn()
      })

    renderWithQueryClient(<MonitoringDashboard />)

    const timeRangeSelect = screen.getByRole('combobox', { name: /time range/i })
    await userEvent.selectOptions(timeRangeSelect, '1h')

    expect(mockRefetch).toHaveBeenCalledWith({
      timeRange: '1h'
    })
  })

  it('filters alerts by severity', async () => {
    renderWithQueryClient(<MonitoringDashboard />)

    const severityFilter = screen.getByRole('combobox', { name: /severity/i })
    await userEvent.selectOptions(severityFilter, 'high')

    // Should filter alerts display
    await waitFor(() => {
      expect(screen.getByText('High CPU Usage')).toBeInTheDocument()
    })
  })

  it('shows loading state for metrics', async () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: null,
        isLoading: true,
        error: null,
        refetch: jest.fn()
      })
      .mockReturnValueOnce({
        data: mockAlertsData,
        isLoading: false,
        error: null,
        refetch: jest.fn()
      })

    renderWithQueryClient(<MonitoringDashboard />)

    expect(screen.getByText('Loading metrics...')).toBeInTheDocument()
  })

  it('shows loading state for alerts', async () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: mockMetricsData,
        isLoading: false,
        error: null,
        refetch: jest.fn()
      })
      .mockReturnValueOnce({
        data: null,
        isLoading: true,
        error: null,
        refetch: jest.fn()
      })

    renderWithQueryClient(<MonitoringDashboard />)

    expect(screen.getByText('Loading alerts...')).toBeInTheDocument()
  })

  it('shows error state for metrics', async () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: null,
        isLoading: false,
        error: new Error('Failed to fetch metrics'),
        refetch: jest.fn()
      })
      .mockReturnValueOnce({
        data: mockAlertsData,
        isLoading: false,
        error: null,
        refetch: jest.fn()
      })

    renderWithQueryClient(<MonitoringDashboard />)

    expect(screen.getByText(/error loading metrics/i)).toBeInTheDocument()
  })

  it('shows error state for alerts', async () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: mockMetricsData,
        isLoading: false,
        error: null,
        refetch: jest.fn()
      })
      .mockReturnValueOnce({
        data: null,
        isLoading: false,
        error: new Error('Failed to fetch alerts'),
        refetch: jest.fn()
      })

    renderWithQueryClient(<MonitoringDashboard />)

    expect(screen.getByText(/error loading alerts/i)).toBeInTheDocument()
  })

  it('refreshes data when refresh button is clicked', async () => {
    const mockRefetch1 = jest.fn()
    const mockRefetch2 = jest.fn()
    
    mockUseQuery
      .mockReturnValueOnce({
        data: mockMetricsData,
        isLoading: false,
        error: null,
        refetch: mockRefetch1
      })
      .mockReturnValueOnce({
        data: mockAlertsData,
        isLoading: false,
        error: null,
        refetch: mockRefetch2
      })

    renderWithQueryClient(<MonitoringDashboard />)

    const refreshButton = screen.getByRole('button', { name: /refresh/i })
    await userEvent.click(refreshButton)

    expect(mockRefetch1).toHaveBeenCalled()
    expect(mockRefetch2).toHaveBeenCalled()
  })

  it('formats metric values correctly', async () => {
    renderWithQueryClient(<MonitoringDashboard />)

    // Should format bytes to GB
    expect(screen.getByText('2.0 GB / 8.0 GB')).toBeInTheDocument()
    expect(screen.getByText('25.0 GB / 100.0 GB')).toBeInTheDocument()
    
    // Should format network speed
    expect(screen.getByText('RX: 1.0 MB/s')).toBeInTheDocument()
    expect(screen.getByText('TX: 512.0 KB/s')).toBeInTheDocument()
  })

  it('handles empty alerts gracefully', async () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: mockMetricsData,
        isLoading: false,
        error: null,
        refetch: jest.fn()
      })
      .mockReturnValueOnce({
        data: { alerts: [], summary: { total: 0, firing: 0, pending: 0, resolved: 0, mttr: 0 } },
        isLoading: false,
        error: null,
        refetch: jest.fn()
      })

    renderWithQueryClient(<MonitoringDashboard />)

    expect(screen.getByText('No active alerts')).toBeInTheDocument()
    expect(screen.getByText('Total: 0')).toBeInTheDocument()
  })
})
/** @jest-environment jsdom */
