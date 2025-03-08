# Changelog

All notable changes to the `rag-browser` project will be documented in this file.

## [2.2.0] - 2025-03-08

### Added
- Added comprehensive test suite using Bun's test framework
- Added common test utilities for shared functionality
- Added test scripts to package.json for running specific test suites
- Added coverage reporting for tests

### Changed
- Improved browser automation performance with simplified element collection
- Enhanced page and action stability checks for more reliable automation
- Optimized browser setup with additional configuration options
- Refactored code for better maintainability and performance
- Updated documentation with detailed testing information

### Fixed
- Fixed process hanging after analysis completion
- Improved domain-specific storage handling
- Fixed timeout issues in browser session handling
- Optimized storage operations to eliminate post-analysis delays
- Implemented proper resource cleanup

## [2.1.1] - 2025-03-04

### Added
- Added local installation options
- Added build script for TypeScript compilation
- Added CHANGELOG.md to track project changes

### Changed
- Updated shebang line for better compatibility with Node.js
- Improved documentation for local installation options
- Updated bin path to point to compiled JavaScript file

### Fixed
- Added @types/node for proper Node.js type support

## [2.0.0] - Initial Release

- Initial release of rag-browser
- CLI Mode for direct webpage analysis
- MCP Server Mode for AI system integration
- Action support for browser automation
- Stability checks for reliable execution
- Multiple output options (console or JSON) 