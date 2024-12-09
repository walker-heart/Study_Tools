#!/bin/bash

# Create backup directory
mkdir -p route_backups

# Loop through all route files
find server/routes -type f -name "*.ts" | while read -r file; do
    # Create backup
    cp "$file" "route_backups/$(basename "$file").bak"

    # Add import if it doesn't exist
    if ! grep -q "import { asyncHandler }" "$file"; then
        sed -i '1i import { asyncHandler } from "../middleware/errorHandling";' "$file"
    fi

    # Replace try/catch blocks with asyncHandler
    sed -i 's/router\.\(get\|post\|put\|delete\|patch\)\(.*\)async (req, res) => {/router.\1\2asyncHandler(async (req, res) => {/g' "$file"

    # Remove try/catch blocks
    sed -i '/try {/d' "$file"
    sed -i '/} catch (error) {/,/}/d' "$file"

    echo "Updated $file"
done

echo "Done! Backups stored in route_backups directory"
echo "Please review the changes and test your routes"