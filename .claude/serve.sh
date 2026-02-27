#!/bin/bash
cd "$(dirname "$0")/.." && /usr/bin/python3 -m http.server "${1:-8080}"
