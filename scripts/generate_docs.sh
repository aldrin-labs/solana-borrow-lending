#!/bin/bash

# Documentation Generation Script
# This script automates the process of generating documentation from Rust source code

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_info() {
    echo -e "${BLUE}INFO:${NC} $1"
}

print_success() {
    echo -e "${GREEN}SUCCESS:${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}WARNING:${NC} $1"
}

print_error() {
    echo -e "${RED}ERROR:${NC} $1"
}

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default paths
SOURCE_DIR="$PROJECT_ROOT/programs/borrow-lending/src"
OUTPUT_DIR="$PROJECT_ROOT/docs/auto-generated"

# Parse command line arguments
VERBOSE=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -s|--source-dir)
            SOURCE_DIR="$2"
            shift 2
            ;;
        -o|--output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -v, --verbose         Enable verbose output"
            echo "  -d, --dry-run         Show what would be done without executing"
            echo "  -s, --source-dir DIR  Source directory to scan (default: programs/borrow-lending/src)"
            echo "  -o, --output-dir DIR  Output directory for generated docs (default: docs/auto-generated)"
            echo "  -h, --help           Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    print_error "python3 is required but not installed"
    exit 1
fi

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    print_error "Source directory does not exist: $SOURCE_DIR"
    exit 1
fi

# Print configuration
print_info "Documentation Generation Configuration:"
echo "  Source Directory: $SOURCE_DIR"
echo "  Output Directory: $OUTPUT_DIR"
echo "  Verbose: $VERBOSE"
echo "  Dry Run: $DRY_RUN"
echo ""

if [ "$DRY_RUN" = true ]; then
    print_info "DRY RUN: Would execute the following command:"
    echo "python3 $SCRIPT_DIR/generate_docs.py --source-dir \"$SOURCE_DIR\" --output-dir \"$OUTPUT_DIR\""
    if [ "$VERBOSE" = true ]; then
        echo "  --verbose"
    fi
    exit 0
fi

# Create output directory if it doesn't exist
if [ ! -d "$OUTPUT_DIR" ]; then
    print_info "Creating output directory: $OUTPUT_DIR"
    mkdir -p "$OUTPUT_DIR"
fi

# Build the command
CMD="python3 $SCRIPT_DIR/generate_docs.py --source-dir \"$SOURCE_DIR\" --output-dir \"$OUTPUT_DIR\""

if [ "$VERBOSE" = true ]; then
    CMD="$CMD --verbose"
fi

# Execute the documentation generator
print_info "Generating documentation..."
eval $CMD

# Check if generation was successful
if [ $? -eq 0 ]; then
    print_success "Documentation generation completed successfully!"
    print_info "Generated files are in: $OUTPUT_DIR"
    
    # List generated files
    if [ "$VERBOSE" = true ] && [ -d "$OUTPUT_DIR" ]; then
        print_info "Generated files:"
        find "$OUTPUT_DIR" -name "*.md" -type f | while read -r file; do
            echo "  - $(basename "$file")"
        done
    fi
    
    # Update main documentation index
    INDEX_FILE="$PROJECT_ROOT/docs/index.md"
    if [ -f "$INDEX_FILE" ]; then
        print_info "Main documentation index exists at: $INDEX_FILE"
        print_info "Consider updating it to reference the auto-generated documentation"
    fi
    
else
    print_error "Documentation generation failed!"
    exit 1
fi