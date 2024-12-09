#!/bin/bash

# Save as find-routes.sh
echo "Route files that might need asyncHandler updates:"
find server/routes -type f -name "*.ts" -o -name "*.js" | while read -r file; do
    echo "- $file"
done