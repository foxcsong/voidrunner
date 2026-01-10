from PIL import Image
import collections

def smart_remove_bg(img_path, tolerance=40):
    try:
        img = Image.open(img_path).convert("RGBA")
        width, height = img.size
        pixels = img.load()
        
        # Collect border pixels
        border_colors = []
        border_coords = []
        
        # Top & Bottom
        for x in range(width):
            border_coords.append((x, 0))
            border_coords.append((x, height-1))
        # Left & Right
        for y in range(1, height-1):
            border_coords.append((0, y))
            border_coords.append((width-1, y))
            
        for x, y in border_coords:
            c = pixels[x, y]
            if c[3] > 0: # Only opaque
                border_colors.append(c)

        if not border_colors:
            print(f"Skipping {img_path}: Border is fully transparent.")
            return

        # Find most common color
        # Simplify color to ignore minor noise for counting
        quantized_colors = [tuple(c[:3]) for c in border_colors]
        if not quantized_colors: return
        
        most_common_rgb, count = collections.Counter(quantized_colors).most_common(1)[0]
        
        # If this color makes up a significant portion of the border (e.g. > 10%)
        if count < len(border_coords) * 0.1:
            print(f"Skipping {img_path}: No dominant background color found.")
            return

        print(f"Removing dominant bg color {most_common_rgb} from {img_path}...")
        
        # Flood Fill
        queue = []
        visited = set()
        
        # Initialize queue with all border pixels matching target color
        for x, y in border_coords:
            c = pixels[x, y]
            if c[3] > 0:
                dist = sum(abs(c[i] - most_common_rgb[i]) for i in range(3))
                if dist <= tolerance:
                    queue.append((x, y))
                    visited.add((x, y))
        
        if not queue:
            return

        while queue:
            cx, cy = queue.pop(0)
            
            # Remove
            pixels[cx, cy] = (0, 0, 0, 0)
            
            # Check neighbors
            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < width and 0 <= ny < height:
                    if (nx, ny) not in visited:
                        nc = pixels[nx, ny]
                        if nc[3] > 0:
                            dist = sum(abs(nc[i] - most_common_rgb[i]) for i in range(3))
                            if dist <= tolerance:
                                visited.add((nx, ny))
                                queue.append((nx, ny))
        
        img.save(img_path)
        print(f"Fixed {img_path}")

    except Exception as e:
        print(f"Error on {img_path}: {e}")

import sys

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Process specific file from CLI
        target = sys.argv[1]
        smart_remove_bg(target)
    else:
        # Default behavior
        assets = [
            'public/assets/player_knife.png',
            'public/assets/player_shoot.png'
        ]
        for asset in assets:
            smart_remove_bg(asset)
