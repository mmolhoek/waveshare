// Example usage of the Waveshare 4.26" ePaper display library

import { EPD4in26, EPD_WIDTH, EPD_HEIGHT } from "../src/index";

async function main() {
  // Initialize the display with default pins
  const epd = new EPD4in26({
    // Optional: customize pins if needed
    // rstPin: 17,
    // dcPin: 25,
    // csPin: 8,
    // busyPin: 24,
    // spiSpeedHz: 4000000,
  });

  try {
    console.log("Initializing EPD...");
    console.time("total test duration");
    console.time("EPD Initialization");
    await epd.init();
    console.timeEnd("EPD Initialization");

    // Example 1: Clear the display
    console.log("Clearing display...");
    console.time("EPD Clear");
    await epd.clear();
    console.timeEnd("EPD Clear");

    // // Wait a bit
    // await delay(2000);
    //
    // // Example 2: Draw some shapes
    console.log("Drawing shapes in the buffer...");
    console.time("EPD Draw Shapes");
    epd.clearBuffer();
    //
    // Draw a border
    epd.drawRect(1, 1, EPD_WIDTH - 2, EPD_HEIGHT - 2, 1); // Draw some filled rectangles
    // epd.fillRect(50, 50, 200, 100, 1);
    // epd.fillRect(300, 50, 200, 100, 0);
    console.timeEnd("EPD Draw Shapes");
    //
    // // Draw some lines
    // epd.drawHLine(50, 200, 700, 1);
    // epd.drawVLine(400, 50, 400, 1);
    //
    // // Display the buffer
    console.log("Displaying buffer on EPD...");
    console.time("EPD Display");
    await epd.display();
    console.timeEnd("EPD Display");
    //
    // // Wait a bit
    // await delay(2000);
    //
    // // Example 3: Create a pattern
    // console.log("Drawing pattern...");
    // epd.clearBuffer();
    //
    // // Create a checkerboard pattern
    // const squareSize = 40;
    // for (let y = 0; y < EPD_HEIGHT; y += squareSize) {
    //   for (let x = 0; x < EPD_WIDTH; x += squareSize) {
    //     const color = (x / squareSize + y / squareSize) % 2;
    //     epd.fillRect(x, y, squareSize, squareSize, color);
    //   }
    // }
    //
    // await epd.display();
    //
    // // Wait before sleeping
    // await delay(2000);
    //
    // // Put display to sleep
    // console.log("Entering sleep mode...");
    // await epd.sleep();
    //
    console.log("waiting before clearing display...");
    console.time("Delay Before Clear");
    await delay(2000);
    console.timeEnd("Delay Before Clear");
    await epd.clear();
    console.timeEnd("total test duration");
    console.log("Done!");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    // Clean up GPIO resources
    epd.cleanup();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run the example
main().catch(console.error);
