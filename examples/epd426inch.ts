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
    await epd.clear(false);

    // Example 2: Draw some shapes
    epd.clearBuffer();
    //
    // epd.fillRect(50, 50, EPD_WIDTH - 100, EPD_HEIGHT - 100, 1);
    // epd.fillRect(100, 100, EPD_WIDTH - 200, EPD_HEIGHT - 200, 0);
    // epd.drawRect(150, 150, EPD_WIDTH - 300, EPD_HEIGHT - 300, 1);
    //
    // // Display the buffer
    // await epd.display();
    //
    // // Put display to sleep
    // console.log("Entering sleep mode...");
    // await epd.sleep();
    //
    // await delay(2000);
    // await epd.init();
    // await epd.clear();
    const image = await epd.loadImageInBuffer("./examples/1bit800x480.bmp");
    await epd.display(image);
    await epd.sleep();
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
