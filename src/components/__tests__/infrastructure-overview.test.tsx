import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import InfrastructureOverview from '../dashboard/infrastructure-overview'

// Mock the useQuery hook
const mockUseQuery = jest.fn()
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: () => mockUseQuery()
}))

// Mock EventSource for SSE
const mockEventSource = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  close: jest.fn(),
  readyState: 1
}

Object.defineProperty(window, 'EventSource', {
  writable: true,
  value: jest.fn(() => mockEventSource)
})

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

const mockInfrastructureData = {
  cluster: {
    status: 'healthy',
    nodes: 3,
    pods: 45,
    services: 12,
    uptime: '5d 12h'
  },
  resources: {
    cpu: { used: 45, total: 100, unit: '%' },
    memory: { used: 6.2, total: 24, unit: 'GB' },
    storage: { used: 250, total: 1000, unit: 'GB' }
  },
  costs: {
    current: 125.50,
    projected: 3890.00,
    currency: 'USD'
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

describe('InfrastructureOverview', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: mockInfrastructureData,
      isLoading: false,
      error: null,
      refetch: jest.fn()
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders infrastructure overview with data', async () => {
    renderWithQueryClient(<InfrastructureOverview />)

    expect(screen.getByText('Infrastructure Overview')).toBeInTheDocument()
    expect(screen.getByText('Cluster Status')).toBeInTheDocument()
    expect(screen.getByText('healthy')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument() // nodes
    expect(screen.getByText('45')).toBeInTheDocument() // pods
  })

  it('displays resource utilization correctly', async () => {
    renderWithQueryClient(<InfrastructureOverview />)

    expect(screen.getByText('Resource Utilization')).toBeInTheDocument()
    expect(screen.getByText('45%')).toBeInTheDocument() // CPU
    expect(screen.getByText('6.2 GB / 24 GB')).toBeInTheDocument() // Memory
    expect(screen.getByText('250 GB / 1000 GB')).toBeInTheDocument() // Storage
  })

  it('displays cost information', async () => {
    renderWithQueryClient(<InfrastructureOverview />)

    expect(screen.getByText('Cost Tracking')).toBeInTheDocument()
    expect(screen.getByText('$125.50')).toBeInTheDocument() // Current
    expect(screen.getByText('$3,890.00')).toBeInTheDocument() // Projected
  })

  it('shows loading state', async () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: jest.fn()
    })

    renderWithQueryClient(<InfrastructureOverview />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows error state', async () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to fetch'),
      refetch: jest.fn()
    })

    renderWithQueryClient(<InfrastructureOverview />)

    expect(screen.getByText(/error/i)).toBeInTheDocument()
  })

  it('refreshes data when refresh button is clicked', async () => {
    const mockRefetch = jest.fn()
    mockUseQuery.mockReturnValue({
      data: mockInfrastructureData,
      isLoading: false,
      error: null,
      refetch: mockRefetch
    })

    renderWithQueryClient(<InfrastructureOverview />)

    const refreshButton = screen.getByRole('button', { name: /refresh/i })
    await userEvent.click(refreshButton)

    expect(mockRefetch).toHaveBeenCalled()
  })

  it('sets up SSE connection for real-time updates', async () => {
    renderWithQueryClient(<InfrastructureOverview />)

    expect(window.EventSource).toHaveBeenCalledWith('/api/stream/metrics?types=metric,health&interval=5000')
    expect(mockEventSource.addEventListener).toHaveBeenCalled()
  })

  it('cleans up SSE connection on unmount', async () => {
    const { unmount } = renderWithQueryClient(<InfrastructureOverview />)

    unmount()

    expect(mockEventSource.close).toHaveBeenCalled()
  })

  it('handles SSE messages correctly', async () => {
    const mockRefetch = jest.fn()
    mockUseQuery.mockReturnValue({
      data: mockInfrastructureData,
      isLoading: false,
      error: null,
      refetch: mockRefetch
    })

    renderWithQueryClient(<InfrastructureOverview />)

    // Simulate SSE message
    const messageHandler = mockEventSource.addEventListener.mock.calls[0][1]
    messageHandler({
      data: JSON.stringify({
        type: 'metric',
        data: mockInfrastructureData
      })
    })

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled()
    })
  })

  it('displays cluster health indicators', async () => {
    renderWithQueryClient(<InfrastructureOverview />)

    // Should show health indicators
    expect(screen.getByText('Cluster Status')).toBeInTheDocument()
    
    // Should show status colors/icons based on health
    const healthIndicator = screen.getByText('healthy')
    expect(healthIndicator).toHaveClass(/text-green/i)
  })

  it('handles unhealthy cluster status', async () => {
    const unhealthyData = {
      ...mockInfrastructureData,
      cluster: {
        ...mockInfrastructureData.cluster,
        status: 'unhealthy'
      }
    }

    mockUseQuery.mockReturnValue({
      data: unhealthyData,
      isLoading: false,
      error: null,
      refetch: jest.fn()
    })

    renderWithQueryClient(<InfrastructureOverview />)

    const healthIndicator = screen.getByText('unhealthy')
    expect(healthIndicator).toHaveClass(/text-red/i)
  })

  it('formats resource percentages correctly', async () => {
    renderWithQueryClient(<InfrastructureOverview />)

    // CPU should show as percentage
    expect(screen.getByText('45%')).toBeInTheDocument()
    
    // Memory and storage should show used/total format
    expect(screen.getByText('6.2 GB / 24 GB')).toBeInTheDocument()
    expect(screen.getByText('250 GB / 1000 GB')).toBeInTheDocument()
  })

  it('formats cost values correctly', async () => {
    renderWithQueryClient(<InfrastructureOverview />)

    // Should format currency properly
    expect(screen.getByText('$125.50')).toBeInTheDocument()
    expect(screen.getByText('$3,890.00')).toBeInTheDocument()
  })

  it('handles missing data gracefully', async () => {
    mockUseQuery.mockReturnValue({
      data: {
        cluster: {},
        resources: {},
        costs: {}
      },
      isLoading: false,
      error: null,
      refetch: jest.fn()
    })

    renderWithQueryClient(<InfrastructureOverview />)

    // Should not crash and show appropriate fallbacks
    expect(screen.getByText('Infrastructure Overview')).toBeInTheDocument()
  })

  it('updates automatically when data changes', async () => {
    const { rerender } = renderWithQueryClient(<InfrastructureOverview />)

    // Initial render
    expect(screen.getByText('45%')).toBeInTheDocument()

    // Update data
    const updatedData = {
      ...mockInfrastructureData,
      resources: {
        ...mockInfrastructureData.resources,
        cpu: { used: 75, total: 100, unit: '%' }
      }
    }

    mockUseQuery.mockReturnValue({
      data: updatedData,
      isLoading: false,
      error: null,
      refetch: jest.fn()
    })

    rerender(
      <QueryClientProvider client={createTestQueryClient()}>
        <InfrastructureOverview />
      </QueryClientProvider>
    )

    expect(screen.getByText('75%')).toBeInTheDocument()
  })
})
/** @jest-environment jsdom */
