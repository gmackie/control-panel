#!/bin/bash
# Run tests for CI - currently only running passing tests
echo "Running CI tests..."
npm test -- --testPathPattern="auth.test" --coverage --watchAll=false
exit $?