# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-XX

### Added
- Initial public release of Etsy MCP Server
- Complete MCP server implementation for Etsy API integration
- OAuth 2.0 authentication with refresh token support
- Shop management tools (getMe, getShop, getShopSections)
- Listing management tools (create, update, images, inventory)
- Seller taxonomy tools for product categorization
- Docker containerization support
- Comprehensive documentation and examples
- Interactive OAuth token helper script
- Full test suite with 98%+ pass rate
- CI/CD pipeline with automated testing
- TypeScript support with strict type checking

### Security
- Secure OAuth implementation with token refresh
- Environment variable configuration support
- Credential validation and error handling
- Non-root Docker container execution

## [Unreleased]

### Changed
- Fixed configuration validation test for missing environment variables
- Added MIT license for public distribution
- Improved error handling and validation

---

**Note**: This changelog will be updated with each release. For detailed commit history, see the Git log.