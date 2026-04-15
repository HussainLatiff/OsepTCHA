function generateGridLayout(maxItems) {
    const canvasSize = 400;
    // Calculate grid dimensions
    const cols = Math.ceil(Math.sqrt(maxItems));
    const rows = Math.ceil(maxItems / cols);

    const cellWidth = canvasSize / cols;
    const cellHeight = canvasSize / rows;

    // Fit size within cell with some padding
    const size = Math.min(64, Math.min(cellWidth, cellHeight) * 0.8);

    const layouts = [];
    let count = 0;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (count >= maxItems) break;

            // Center the item in the grid cell
            const x = c * cellWidth + (cellWidth - size) / 2;
            const y = r * cellHeight + (cellHeight - size) / 2;

            layouts.push({ x: Math.round(x), y: Math.round(y), width: Math.round(size), height: Math.round(size) });
            count++;
        }
    }
    return layouts;
}

function generateDynamicLayout(maxItems) {
    const canvasSize = 400;
    const minSize = 16;
    const maxSize = 64;
    const maxRetries = 100;

    const layouts = [];

    for (let i = 0; i < maxItems; i++) {
        let placed = false;
        for (let retry = 0; retry < maxRetries; retry++) {
            const size = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
            // Ensure X + Size <= 400 and Y + Size <= 400
            const x = Math.floor(Math.random() * (canvasSize - size + 1));
            const y = Math.floor(Math.random() * (canvasSize - size + 1));

            // Check collision against already placed items
            let overlap = false;
            for (const item of layouts) {
                if (
                    x < item.x + item.width &&
                    x + size > item.x &&
                    y < item.y + item.height &&
                    y + size > item.y
                ) {
                    overlap = true;
                    break;
                }
            }

            if (!overlap) {
                layouts.push({ x, y, width: size, height: size });
                placed = true;
                break;
            }
        }

        // If an overlap occurs 100 times, we just move on up to what we placed so far
        // or log a warning if needed.
    }

    return layouts;
}

function generateCollidingLayout(maxItems) {
    const canvasSize = 400;
    const minSize = 24;
    const maxSize = 48;

    const layouts = [];

    for (let i = 0; i < maxItems; i++) {
        const size = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
        const x = Math.floor(Math.random() * (canvasSize - size + 1));
        const y = Math.floor(Math.random() * (canvasSize - size + 1));
        
        layouts.push({ x, y, width: size, height: size });
    }

    return layouts;
}

module.exports = {
    generateGridLayout,
    generateDynamicLayout,
    generateCollidingLayout
};
