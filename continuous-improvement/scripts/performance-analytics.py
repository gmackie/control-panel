#!/usr/bin/env python3
"""
Performance Analytics Collector
Collects and analyzes performance metrics to identify improvement opportunities
"""

import os
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from prometheus_api_client import PrometheusConnect
import requests


class PerformanceAnalytics:
    def __init__(self):
        self.prometheus_url = os.getenv('PROMETHEUS_URL', 'http://prometheus:9090')
        self.output_path = os.getenv('OUTPUT_PATH', '/output/performance-analytics')
        self.prom = PrometheusConnect(url=self.prometheus_url)
        
    def collect_metrics(self, days_back=7):
        """Collect performance metrics from the last N days"""
        end_time = datetime.now()
        start_time = end_time - timedelta(days=days_back)
        
        metrics = {
            'response_times': self.get_response_time_metrics(start_time, end_time),
            'error_rates': self.get_error_rate_metrics(start_time, end_time),
            'throughput': self.get_throughput_metrics(start_time, end_time),
            'resource_usage': self.get_resource_usage_metrics(start_time, end_time),
            'user_behavior': self.get_user_behavior_metrics(start_time, end_time)
        }
        
        return metrics
    
    def get_response_time_metrics(self, start_time, end_time):
        """Get response time metrics by endpoint"""
        query = '''
        histogram_quantile(0.95, 
          sum(rate(http_request_duration_seconds_bucket{job="control-panel"}[5m])) 
          by (le, endpoint)
        )
        '''
        
        result = self.prom.custom_query_range(
            query=query,
            start_time=start_time,
            end_time=end_time,
            step='1h'
        )
        
        return self.process_prometheus_result(result)
    
    def get_error_rate_metrics(self, start_time, end_time):
        """Get error rate metrics by endpoint"""
        query = '''
        sum(rate(http_requests_total{job="control-panel",status=~"5.."}[5m])) by (endpoint) /
        sum(rate(http_requests_total{job="control-panel"}[5m])) by (endpoint) * 100
        '''
        
        result = self.prom.custom_query_range(
            query=query,
            start_time=start_time,
            end_time=end_time,
            step='1h'
        )
        
        return self.process_prometheus_result(result)
    
    def get_throughput_metrics(self, start_time, end_time):
        """Get throughput metrics"""
        query = '''
        sum(rate(http_requests_total{job="control-panel"}[5m])) by (endpoint)
        '''
        
        result = self.prom.custom_query_range(
            query=query,
            start_time=start_time,
            end_time=end_time,
            step='1h'
        )
        
        return self.process_prometheus_result(result)
    
    def get_resource_usage_metrics(self, start_time, end_time):
        """Get resource usage metrics"""
        queries = {
            'cpu': 'sum(rate(container_cpu_usage_seconds_total{container="control-panel"}[5m]))',
            'memory': 'sum(container_memory_usage_bytes{container="control-panel"}) / 1024 / 1024 / 1024',
            'db_connections': 'pg_stat_database_numbackends{datname="control_panel"}'
        }
        
        metrics = {}
        for metric_name, query in queries.items():
            result = self.prom.custom_query_range(
                query=query,
                start_time=start_time,
                end_time=end_time,
                step='1h'
            )
            metrics[metric_name] = self.process_prometheus_result(result)
        
        return metrics
    
    def get_user_behavior_metrics(self, start_time, end_time):
        """Get user behavior metrics"""
        # This would typically come from application logs or analytics
        # For now, we'll create synthetic data based on request patterns
        query = '''
        sum(rate(http_requests_total{job="control-panel"}[5m])) by (endpoint)
        '''
        
        result = self.prom.custom_query_range(
            query=query,
            start_time=start_time,
            end_time=end_time,
            step='1h'
        )
        
        return self.process_prometheus_result(result)
    
    def process_prometheus_result(self, result):
        """Process Prometheus query result into analyzable format"""
        processed = []
        
        for series in result:
            metric = series['metric']
            values = series['values']
            
            for timestamp, value in values:
                processed.append({
                    'timestamp': datetime.fromtimestamp(timestamp),
                    'value': float(value),
                    **metric
                })
        
        return processed
    
    def analyze_performance_trends(self, metrics):
        """Analyze performance trends and identify issues"""
        analysis = {
            'response_time_trends': self.analyze_response_times(metrics['response_times']),
            'error_rate_trends': self.analyze_error_rates(metrics['error_rates']),
            'capacity_analysis': self.analyze_capacity(metrics['resource_usage']),
            'user_experience': self.analyze_user_experience(metrics),
            'recommendations': []
        }
        
        # Generate recommendations based on analysis
        analysis['recommendations'] = self.generate_recommendations(analysis)
        
        return analysis
    
    def analyze_response_times(self, response_time_data):
        """Analyze response time trends"""
        if not response_time_data:
            return {}
        
        df = pd.DataFrame(response_time_data)
        
        analysis = {
            'overall_trend': self.calculate_trend(df['value']),
            'slowest_endpoints': df.groupby('endpoint')['value'].mean().nlargest(5).to_dict(),
            'degradation_alerts': [],
            'peak_hours': self.identify_peak_hours(df)
        }
        
        # Check for degradation
        for endpoint in df['endpoint'].unique():
            endpoint_data = df[df['endpoint'] == endpoint]
            if len(endpoint_data) > 24:  # At least 24 hours of data
                recent_avg = endpoint_data.tail(12)['value'].mean()
                historical_avg = endpoint_data.head(-12)['value'].mean()
                
                if recent_avg > historical_avg * 1.2:  # 20% degradation
                    analysis['degradation_alerts'].append({
                        'endpoint': endpoint,
                        'degradation_percent': ((recent_avg - historical_avg) / historical_avg) * 100,
                        'current_avg': recent_avg,
                        'historical_avg': historical_avg
                    })
        
        return analysis
    
    def analyze_error_rates(self, error_rate_data):
        """Analyze error rate trends"""
        if not error_rate_data:
            return {}
        
        df = pd.DataFrame(error_rate_data)
        
        analysis = {
            'overall_trend': self.calculate_trend(df['value']),
            'highest_error_endpoints': df.groupby('endpoint')['value'].mean().nlargest(5).to_dict(),
            'error_spikes': self.detect_error_spikes(df),
            'reliability_score': self.calculate_reliability_score(df)
        }
        
        return analysis
    
    def analyze_capacity(self, resource_data):
        """Analyze capacity and resource usage"""
        analysis = {}
        
        for resource_type, data in resource_data.items():
            if not data:
                continue
                
            df = pd.DataFrame(data)
            
            analysis[resource_type] = {
                'average_usage': df['value'].mean(),
                'peak_usage': df['value'].max(),
                'trend': self.calculate_trend(df['value']),
                'utilization_pattern': self.analyze_utilization_pattern(df),
                'capacity_warnings': self.check_capacity_warnings(df, resource_type)
            }
        
        return analysis
    
    def analyze_user_experience(self, all_metrics):
        """Analyze overall user experience metrics"""
        # Combine multiple metrics to assess user experience
        ux_score = 100  # Start with perfect score
        
        # Reduce score based on performance issues
        if all_metrics.get('response_times'):
            rt_df = pd.DataFrame(all_metrics['response_times'])
            avg_response_time = rt_df['value'].mean()
            if avg_response_time > 0.5:  # 500ms
                ux_score -= min(50, (avg_response_time - 0.5) * 100)
        
        if all_metrics.get('error_rates'):
            er_df = pd.DataFrame(all_metrics['error_rates'])
            avg_error_rate = er_df['value'].mean()
            ux_score -= min(30, avg_error_rate * 10)
        
        return {
            'overall_ux_score': max(0, ux_score),
            'ux_trend': 'improving' if ux_score > 80 else 'declining' if ux_score < 60 else 'stable',
            'primary_pain_points': self.identify_ux_pain_points(all_metrics)
        }
    
    def generate_recommendations(self, analysis):
        """Generate improvement recommendations based on analysis"""
        recommendations = []
        
        # Response time recommendations
        rt_analysis = analysis.get('response_time_trends', {})
        if rt_analysis.get('degradation_alerts'):
            for alert in rt_analysis['degradation_alerts']:
                recommendations.append({
                    'type': 'performance',
                    'priority': 'high',
                    'title': f"Performance degradation on {alert['endpoint']}",
                    'description': f"Response time increased by {alert['degradation_percent']:.1f}%",
                    'suggested_actions': [
                        'Profile endpoint performance',
                        'Check database query efficiency',
                        'Consider caching strategies',
                        'Review recent code changes'
                    ],
                    'impact': 'user_experience'
                })
        
        # Capacity recommendations
        capacity_analysis = analysis.get('capacity_analysis', {})
        for resource, data in capacity_analysis.items():
            if data.get('capacity_warnings'):
                for warning in data['capacity_warnings']:
                    recommendations.append({
                        'type': 'capacity',
                        'priority': warning['severity'],
                        'title': f"{resource.upper()} capacity warning",
                        'description': warning['message'],
                        'suggested_actions': warning['actions'],
                        'impact': 'reliability'
                    })
        
        # Error rate recommendations
        er_analysis = analysis.get('error_rate_trends', {})
        if er_analysis.get('error_spikes'):
            recommendations.append({
                'type': 'reliability',
                'priority': 'high',
                'title': 'Error rate spikes detected',
                'description': f"Detected {len(er_analysis['error_spikes'])} error spikes",
                'suggested_actions': [
                    'Investigate error patterns',
                    'Improve error handling',
                    'Add more comprehensive monitoring',
                    'Consider circuit breaker patterns'
                ],
                'impact': 'user_experience'
            })
        
        return recommendations
    
    def calculate_trend(self, values):
        """Calculate trend direction for a series of values"""
        if len(values) < 2:
            return 'insufficient_data'
        
        # Simple linear regression to determine trend
        x = np.arange(len(values))
        z = np.polyfit(x, values, 1)
        slope = z[0]
        
        if slope > 0.01:
            return 'increasing'
        elif slope < -0.01:
            return 'decreasing'
        else:
            return 'stable'
    
    def identify_peak_hours(self, df):
        """Identify peak usage hours"""
        df['hour'] = df['timestamp'].dt.hour
        hourly_avg = df.groupby('hour')['value'].mean()
        peak_hours = hourly_avg.nlargest(3).index.tolist()
        return peak_hours
    
    def detect_error_spikes(self, df):
        """Detect error rate spikes"""
        mean_error_rate = df['value'].mean()
        std_error_rate = df['value'].std()
        threshold = mean_error_rate + (2 * std_error_rate)
        
        spikes = df[df['value'] > threshold]
        return spikes.to_dict('records')
    
    def calculate_reliability_score(self, df):
        """Calculate reliability score based on error rates"""
        avg_error_rate = df['value'].mean()
        reliability_score = max(0, 100 - (avg_error_rate * 10))
        return reliability_score
    
    def analyze_utilization_pattern(self, df):
        """Analyze resource utilization patterns"""
        df['hour'] = df['timestamp'].dt.hour
        hourly_pattern = df.groupby('hour')['value'].mean().to_dict()
        
        return {
            'peak_hour': max(hourly_pattern, key=hourly_pattern.get),
            'low_hour': min(hourly_pattern, key=hourly_pattern.get),
            'pattern': hourly_pattern
        }
    
    def check_capacity_warnings(self, df, resource_type):
        """Check for capacity warnings"""
        warnings = []
        avg_usage = df['value'].mean()
        max_usage = df['value'].max()
        
        # Define thresholds by resource type
        thresholds = {
            'cpu': {'warning': 70, 'critical': 85},
            'memory': {'warning': 80, 'critical': 90},
            'db_connections': {'warning': 70, 'critical': 85}
        }
        
        threshold = thresholds.get(resource_type, {'warning': 80, 'critical': 90})
        
        if max_usage > threshold['critical']:
            warnings.append({
                'severity': 'critical',
                'message': f'Peak {resource_type} usage at {max_usage:.1f}%',
                'actions': [f'Scale up {resource_type} resources', 'Optimize resource usage', 'Add auto-scaling']
            })
        elif avg_usage > threshold['warning']:
            warnings.append({
                'severity': 'warning',
                'message': f'Average {resource_type} usage at {avg_usage:.1f}%',
                'actions': [f'Monitor {resource_type} trends', 'Plan for capacity increase', 'Optimize usage patterns']
            })
        
        return warnings
    
    def identify_ux_pain_points(self, all_metrics):
        """Identify primary user experience pain points"""
        pain_points = []
        
        # Check response times
        if all_metrics.get('response_times'):
            rt_df = pd.DataFrame(all_metrics['response_times'])
            slow_endpoints = rt_df.groupby('endpoint')['value'].mean()
            for endpoint, avg_time in slow_endpoints.items():
                if avg_time > 1.0:  # 1 second threshold
                    pain_points.append({
                        'type': 'slow_response',
                        'endpoint': endpoint,
                        'average_time': avg_time,
                        'impact': 'high'
                    })
        
        return pain_points
    
    def save_results(self, metrics, analysis):
        """Save analysis results"""
        os.makedirs(self.output_path, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Save raw metrics
        with open(f'{self.output_path}/metrics_{timestamp}.json', 'w') as f:
            json.dump(metrics, f, indent=2, default=str)
        
        # Save analysis
        with open(f'{self.output_path}/analysis_{timestamp}.json', 'w') as f:
            json.dump(analysis, f, indent=2, default=str)
        
        # Save recommendations in CSV for easy review
        if analysis.get('recommendations'):
            df_recommendations = pd.DataFrame(analysis['recommendations'])
            df_recommendations.to_csv(f'{self.output_path}/recommendations_{timestamp}.csv', index=False)
        
        print(f"Analytics saved to {self.output_path}")
        print(f"Generated {len(analysis.get('recommendations', []))} recommendations")


def main():
    """Main execution function"""
    analyzer = PerformanceAnalytics()
    
    print("Collecting performance metrics...")
    metrics = analyzer.collect_metrics(days_back=7)
    
    print("Analyzing performance trends...")
    analysis = analyzer.analyze_performance_trends(metrics)
    
    print("Saving results...")
    analyzer.save_results(metrics, analysis)
    
    print("Performance analytics completed successfully!")


if __name__ == '__main__':
    main()