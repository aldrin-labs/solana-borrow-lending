#!/usr/bin/env python3
"""
Automated Documentation Generation Utility

This script extracts documentation from Rust source code and generates
comprehensive documentation files for the Solana Borrow-Lending Protocol.
It separates inline code documentation from external documentation files.
"""

import os
import re
import json
import argparse
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class StructInfo:
    """Information about a Rust struct."""
    name: str
    doc_comment: str
    fields: List[Tuple[str, str, str]]  # (name, type, doc)
    attributes: List[str]
    file_path: str
    line_number: int
    size_calculation: Optional[str] = None


@dataclass
class FunctionInfo:
    """Information about a Rust function."""
    name: str
    doc_comment: str
    signature: str
    file_path: str
    line_number: int
    is_public: bool
    parameters: List[Tuple[str, str]]  # (name, type)
    return_type: str


class RustDocExtractor:
    """Extracts documentation from Rust source files."""
    
    def __init__(self, source_dir: str):
        self.source_dir = Path(source_dir)
        self.structs: List[StructInfo] = []
        self.functions: List[FunctionInfo] = []
        
    def extract_all(self) -> None:
        """Extract documentation from all Rust files."""
        for rust_file in self.source_dir.rglob("*.rs"):
            self._extract_from_file(rust_file)
    
    def _extract_from_file(self, file_path: Path) -> None:
        """Extract documentation from a single Rust file."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            self._extract_structs(content, file_path)
            self._extract_functions(content, file_path)
            
        except Exception as e:
            print(f"Warning: Failed to process {file_path}: {e}")
    
    def _extract_structs(self, content: str, file_path: Path) -> None:
        """Extract struct definitions and documentation."""
        # Pattern to match struct definitions with doc comments
        struct_pattern = re.compile(
            r'(?P<doc>(?:///.*\n)*)\s*'
            r'(?P<attrs>(?:#\[.*\]\s*)*)'
            r'pub\s+struct\s+(?P<name>\w+)\s*'
            r'(?:<[^>]*>)?\s*\{\s*'
            r'(?P<fields>.*?)\s*\}',
            re.MULTILINE | re.DOTALL
        )
        
        for match in struct_pattern.finditer(content):
            doc_comment = self._clean_doc_comment(match.group('doc'))
            attrs = [attr.strip() for attr in re.findall(r'#\[([^\]]+)\]', match.group('attrs'))]
            name = match.group('name')
            fields_text = match.group('fields')
            
            # Extract fields
            fields = self._extract_fields(fields_text)
            
            # Find line number
            line_number = content[:match.start()].count('\n') + 1
            
            # Look for size calculation method
            size_calc = self._find_size_calculation(content, name)
            
            struct_info = StructInfo(
                name=name,
                doc_comment=doc_comment,
                fields=fields,
                attributes=attrs,
                file_path=str(file_path.relative_to(self.source_dir)),
                line_number=line_number,
                size_calculation=size_calc
            )
            
            self.structs.append(struct_info)
    
    def _extract_functions(self, content: str, file_path: Path) -> None:
        """Extract function definitions and documentation."""
        # Pattern to match function definitions with doc comments
        func_pattern = re.compile(
            r'(?P<doc>(?:///.*\n)*)\s*'
            r'(?P<visibility>pub\s+)?'
            r'fn\s+(?P<name>\w+)\s*'
            r'(?:<[^>]*>)?\s*'
            r'\((?P<params>[^)]*)\)\s*'
            r'(?:->\s*(?P<return>[^{;]+))?\s*'
            r'[{;]',
            re.MULTILINE
        )
        
        for match in func_pattern.finditer(content):
            doc_comment = self._clean_doc_comment(match.group('doc'))
            name = match.group('name')
            is_public = match.group('visibility') is not None
            params_text = match.group('params') or ""
            return_type = match.group('return') or "()"
            
            # Extract parameters
            parameters = self._extract_parameters(params_text)
            
            # Find line number
            line_number = content[:match.start()].count('\n') + 1
            
            # Create signature
            signature = f"fn {name}({params_text}) -> {return_type.strip()}"
            
            func_info = FunctionInfo(
                name=name,
                doc_comment=doc_comment,
                signature=signature,
                file_path=str(file_path.relative_to(self.source_dir)),
                line_number=line_number,
                is_public=is_public,
                parameters=parameters,
                return_type=return_type.strip()
            )
            
            self.functions.append(func_info)
    
    def _clean_doc_comment(self, doc_text: str) -> str:
        """Clean up doc comments by removing /// prefixes."""
        if not doc_text:
            return ""
        
        lines = doc_text.strip().split('\n')
        cleaned_lines = []
        
        for line in lines:
            line = line.strip()
            if line.startswith('///'):
                cleaned_lines.append(line[3:].strip())
            elif line.startswith('//!'):
                cleaned_lines.append(line[3:].strip())
        
        return '\n'.join(cleaned_lines)
    
    def _extract_fields(self, fields_text: str) -> List[Tuple[str, str, str]]:
        """Extract field information from struct body."""
        fields = []
        
        # Pattern to match field definitions with optional doc comments
        field_pattern = re.compile(
            r'(?P<doc>(?:///.*\n)*)\s*'
            r'pub\s+(?P<name>\w+)\s*:\s*(?P<type>[^,\n]+)',
            re.MULTILINE
        )
        
        for match in field_pattern.finditer(fields_text):
            doc = self._clean_doc_comment(match.group('doc'))
            name = match.group('name')
            field_type = match.group('type').strip().rstrip(',')
            
            fields.append((name, field_type, doc))
        
        return fields
    
    def _extract_parameters(self, params_text: str) -> List[Tuple[str, str]]:
        """Extract parameter information from function signature."""
        if not params_text.strip():
            return []
        
        parameters = []
        
        # Simple parameter extraction (could be improved for complex types)
        param_parts = params_text.split(',')
        
        for param in param_parts:
            param = param.strip()
            if ':' in param:
                name_part, type_part = param.split(':', 1)
                name = name_part.strip()
                param_type = type_part.strip()
                
                # Clean up common patterns
                if name.startswith('mut '):
                    name = name[4:]
                if name.startswith('&'):
                    name = name[1:]
                
                parameters.append((name, param_type))
        
        return parameters
    
    def _find_size_calculation(self, content: str, struct_name: str) -> Optional[str]:
        """Find size calculation method for a struct."""
        # Look for impl block with space() method
        impl_pattern = re.compile(
            rf'impl\s+(?:{struct_name}|ZeroCopyAccount\s+for\s+{struct_name})\s*{{[^}}]*?'
            rf'fn\s+space\(\)\s*->\s*usize\s*{{\s*([^}}]+)\s*}}'
        )
        
        match = impl_pattern.search(content)
        if match:
            return match.group(1).strip()
        
        return None


class DocumentationGenerator:
    """Generates documentation files from extracted information."""
    
    def __init__(self, extractor: RustDocExtractor, output_dir: str):
        self.extractor = extractor
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
    
    def generate_all(self) -> None:
        """Generate all documentation files."""
        self.generate_zero_copy_reference()
        self.generate_api_structures()
        self.generate_function_reference()
        self.generate_index()
    
    def generate_zero_copy_reference(self) -> None:
        """Generate zero-copy structures reference."""
        zero_copy_structs = [
            s for s in self.extractor.structs 
            if 'account(zero_copy)' in ' '.join(s.attributes)
        ]
        
        if not zero_copy_structs:
            return
        
        content = [
            "# Zero-Copy Structures Reference\n",
            "This document provides detailed reference information for all zero-copy structures ",
            "in the Solana Borrow-Lending Protocol.\n",
            "## Overview\n",
            f"Total zero-copy structures: **{len(zero_copy_structs)}**\n",
        ]
        
        for struct in zero_copy_structs:
            content.extend(self._generate_struct_section(struct))
        
        self._write_file("zero-copy-reference.md", content)
    
    def generate_api_structures(self) -> None:
        """Generate API structures documentation."""
        content = [
            "# API Structures Reference\n",
            "Comprehensive reference for all data structures used in the protocol.\n",
        ]
        
        # Group by category
        categories = {
            "Account Structures": [],
            "Data Structures": [],
            "Configuration Structures": [],
            "Other Structures": []
        }
        
        for struct in self.extractor.structs:
            if 'account' in ' '.join(struct.attributes):
                categories["Account Structures"].append(struct)
            elif 'config' in struct.name.lower():
                categories["Configuration Structures"].append(struct)
            elif any(keyword in struct.name.lower() for keyword in ['data', 'info', 'cap', 'snapshot']):
                categories["Data Structures"].append(struct)
            else:
                categories["Other Structures"].append(struct)
        
        for category, structs in categories.items():
            if structs:
                content.append(f"## {category}\n")
                for struct in structs:
                    content.extend(self._generate_struct_section(struct))
        
        self._write_file("api-structures.md", content)
    
    def generate_function_reference(self) -> None:
        """Generate function reference documentation."""
        public_functions = [f for f in self.extractor.functions if f.is_public]
        
        content = [
            "# Function Reference\n",
            "Reference documentation for all public functions in the protocol.\n",
            f"Total public functions: **{len(public_functions)}**\n",
        ]
        
        # Group by file
        by_file = {}
        for func in public_functions:
            file_key = func.file_path
            if file_key not in by_file:
                by_file[file_key] = []
            by_file[file_key].append(func)
        
        for file_path, functions in sorted(by_file.items()):
            content.append(f"## {file_path}\n")
            
            for func in functions:
                content.extend(self._generate_function_section(func))
        
        self._write_file("function-reference.md", content)
    
    def generate_index(self) -> None:
        """Generate index of all generated documentation."""
        content = [
            "# Auto-Generated Documentation Index\n",
            "This index is automatically generated from the Rust source code.\n",
            f"Last updated: {self._get_timestamp()}\n",
            "## Statistics\n",
            f"- **Structures documented**: {len(self.extractor.structs)}\n",
            f"- **Functions documented**: {len(self.extractor.functions)}\n",
            f"- **Zero-copy structures**: {len([s for s in self.extractor.structs if 'account(zero_copy)' in ' '.join(s.attributes)])}\n",
            "## Generated Files\n",
            "- [Zero-Copy Structures Reference](zero-copy-reference.md)\n",
            "- [API Structures Reference](api-structures.md)\n",
            "- [Function Reference](function-reference.md)\n",
            "## Manual Documentation\n",
            "- [Zero-Copy Architecture Guide](zero-copy-architecture.md)\n",
            "- [Performance Optimization Guide](performance-optimization.md)\n",
            "- [API Reference](api-reference.md)\n",
            "- [User Tutorials](user-tutorials.md)\n",
            "- [Developer Guide](developer-guide.md)\n",
        ]
        
        self._write_file("auto-generated-index.md", content)
    
    def _generate_struct_section(self, struct: StructInfo) -> List[str]:
        """Generate documentation section for a struct."""
        content = [
            f"### {struct.name}\n",
            f"**Location**: `{struct.file_path}:{struct.line_number}`\n",
        ]
        
        if struct.attributes:
            content.append(f"**Attributes**: `{', '.join(struct.attributes)}`\n")
        
        if struct.doc_comment:
            content.extend([struct.doc_comment, "\n"])
        
        if struct.size_calculation:
            content.extend([
                "**Size Calculation**:\n",
                "```rust\n",
                struct.size_calculation,
                "\n```\n"
            ])
        
        if struct.fields:
            content.append("**Fields**:\n")
            for name, field_type, doc in struct.fields:
                content.append(f"- `{name}: {field_type}`")
                if doc:
                    content.append(f" - {doc}")
                content.append("\n")
        
        content.append("\n")
        return content
    
    def _generate_function_section(self, func: FunctionInfo) -> List[str]:
        """Generate documentation section for a function."""
        content = [
            f"### {func.name}\n",
            f"**Location**: `{func.file_path}:{func.line_number}`\n",
            f"**Signature**: `{func.signature}`\n",
        ]
        
        if func.doc_comment:
            content.extend([func.doc_comment, "\n"])
        
        if func.parameters:
            content.append("**Parameters**:\n")
            for name, param_type in func.parameters:
                content.append(f"- `{name}: {param_type}`\n")
        
        content.append(f"**Returns**: `{func.return_type}`\n\n")
        return content
    
    def _write_file(self, filename: str, content: List[str]) -> None:
        """Write content to a file."""
        file_path = self.output_dir / filename
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(''.join(content))
        
        print(f"Generated: {file_path}")
    
    def _get_timestamp(self) -> str:
        """Get current timestamp for documentation."""
        from datetime import datetime
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Generate documentation from Rust source code"
    )
    parser.add_argument(
        "--source-dir", 
        default="programs/borrow-lending/src",
        help="Source directory to scan for Rust files"
    )
    parser.add_argument(
        "--output-dir",
        default="docs/auto-generated",
        help="Output directory for generated documentation"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose output"
    )
    
    args = parser.parse_args()
    
    if args.verbose:
        print(f"Scanning source directory: {args.source_dir}")
        print(f"Output directory: {args.output_dir}")
    
    # Extract documentation from source
    extractor = RustDocExtractor(args.source_dir)
    extractor.extract_all()
    
    if args.verbose:
        print(f"Found {len(extractor.structs)} structs and {len(extractor.functions)} functions")
    
    # Generate documentation files
    generator = DocumentationGenerator(extractor, args.output_dir)
    generator.generate_all()
    
    print("Documentation generation complete!")


if __name__ == "__main__":
    main()