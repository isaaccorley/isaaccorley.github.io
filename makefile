# Makefile for Isaac's Personal Website

# Default target
.PHONY: help
help:
	@echo "Available commands:"
	@echo "  make install    - Install dependencies"
	@echo "  make dev        - Start development server"
	@echo "  make build      - Build for production"
	@echo "  make start      - Start production server"
	@echo "  make clean      - Clean build artifacts"
	@echo "  make lint       - Run linting"
	@echo "  make test       - Build and test locally"
	@echo "  make deploy     - Build for GitHub Pages deployment"

# Install dependencies
.PHONY: install
install:
	npm install

# Start development server
.PHONY: dev
dev:
	npm run dev

# Build for production
.PHONY: build
build:
	npm run build

# Start production server (for testing build locally)
.PHONY: start
start:
	npm run start

# Clean build artifacts
.PHONY: clean
clean:
	rm -rf .next
	rm -rf out

# Run linting
.PHONY: lint
lint:
	npm run lint

# Build and test locally (build + start production server)
.PHONY: test
test: build
	@echo "Build completed successfully!"
	@echo "Starting production server on http://localhost:3000"
	@echo "Press Ctrl+C to stop the server"
	npm run start

# Build for GitHub Pages (static export)
.PHONY: deploy
deploy: clean
	@echo "Building for GitHub Pages deployment..."
	npm run build
	@echo "Build completed! Ready to deploy to GitHub Pages"
	@echo "Files are in the .next directory"

# Build for GitHub Pages (static export)
.PHONY: gh-pages
gh-pages: clean
	@echo "Building static site for GitHub Pages..."
	npm run build
	@echo "Static files generated in 'out' directory"
	@echo "Ready to deploy to GitHub Pages!"