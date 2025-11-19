// Example usage of the Waveshare 4.26" ePaper display library

import { EPD4in26, EPD_WIDTH, EPD_HEIGHT } from "../src/index";

async function main() {
  // Initialize the display with default pins
  const epd = new EPD4in26({
    debug: true, // Enable debug mode for verbose logging
  });

  try {
    // Initialize the display
    await epd.init();

    // Example 1: Clear the display
    await epd.clear();

    // Example 2: Draw some shapes
    epd.clearBuffer();
    //
    // Draw a border
    // epd.drawRect(1, 1, EPD_WIDTH - 2, EPD_HEIGHT - 2, 1); // Draw some filled rectangles
    epd.fillRect(50, 50, 700, 380, 1);
    epd.fillRect(100, 100, 600, 280, 0);
    // epd.fillRect(300, 50, 200, 100, 0);
    //
    // // Draw some lines
    epd.drawRect(150, 150, 500, 180, 1);
    // epd.drawVLine(400, 50, 400, 1);
    //
    // // Display the buffer
    await epd.display();
    //
    // // Put display to sleep
    // console.log("Entering sleep mode...");
    await epd.sleep();
    //
    await delay(2000);
    await epd.init();
    await epd.clear();
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
