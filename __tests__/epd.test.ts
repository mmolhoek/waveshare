import { EPD } from "../src/index";
import * as lgpio from "lgpio";

// Mock lgpio library
jest.mock("lgpio", () => ({
  gpiochipOpen: jest.fn(() => 0),
  spiOpen: jest.fn(() => 1),
  gpioClaimOutput: jest.fn(),
  gpioClaimInput: jest.fn(),
  gpioWrite: jest.fn(),
  gpioRead: jest.fn(() => false),
  spiWrite: jest.fn(),
  gpiochipClose: jest.fn(),
  spiClose: jest.fn(),
}));

describe("EPD Class", () => {
  let epd: EPD;

  beforeEach(() => {
    epd = new EPD({ debug: false });
  });

  afterEach(() => {
    jest.clearAllMocks();
    epd.cleanup();
    jest.useRealTimers(); // Restore real timers after each test
  });

  test("should initialize with default configuration", () => {
    expect(epd.width).toBe(800);
    expect(epd.height).toBe(480);
    expect(lgpio.gpiochipOpen).toHaveBeenCalledWith(0);
    expect(lgpio.spiOpen).toHaveBeenCalledWith(0, 0, 256000);
  });

  test("should reset the display", async () => {
    jest.useFakeTimers(); // Use Jest's fake timers

    jest.clearAllMocks(); // Clear any calls made during initialization

    const resetPromise = epd["reset"](); // Call the reset method
    jest.advanceTimersByTime(20); // Advance time for the first delay
    await Promise.resolve(); // Allow the event loop to process the delay
    jest.advanceTimersByTime(2); // Advance time for the second delay
    await Promise.resolve(); // Allow the event loop to process the delay
    jest.advanceTimersByTime(20); // Advance time for the third delay
    await Promise.resolve(); // Allow the event loop to process the delay
    await resetPromise; // Wait for the reset method to complete

    expect(lgpio.gpioWrite).toHaveBeenCalledTimes(3);
  });

  test("should send a command to the display", () => {
    epd["sendCommand"](0x12);
    expect(lgpio.gpioWrite).toHaveBeenCalledWith(0, 25, false);
    expect(lgpio.spiWrite).toHaveBeenCalledWith(1, new Uint8Array([0x12]));
  });

  test("should send data to the display", () => {
    epd["sendData"](0x80);
    expect(lgpio.gpioWrite).toHaveBeenCalledWith(0, 25, true);
    expect(lgpio.spiWrite).toHaveBeenCalledWith(1, new Uint8Array([0x80]));
  });

  test("should clear the display buffer", async () => {
    const turnOnDisplaySpy = jest.spyOn(epd as any, "turnOnDisplay");
    await epd.clear();
    expect(epd.getBuffer().every((byte) => byte === 0xff)).toBe(true);
    expect(turnOnDisplaySpy).toHaveBeenCalledWith(true);
  });

  test("should set a pixel in the buffer", () => {
    epd.setPixel(10, 10, 1);
    const buffer = epd.getBuffer();
    const byteIndex = (10 + 10 * 800) >> 3;
    const bitIndex = 7 - (10 & 7);
    expect((buffer[byteIndex] & (1 << bitIndex)) === 0).toBe(true);
  });

  test("should draw a horizontal line", () => {
    epd.drawHLine(0, 0, 10, 1);
    const buffer = epd.getBuffer();
    for (let i = 0; i < 10; i++) {
      const byteIndex = i >> 3;
      const bitIndex = 7 - (i & 7);
      expect((buffer[byteIndex] & (1 << bitIndex)) === 0).toBe(true);
    }
  });

  test("should load an image into the buffer", async () => {
    const mockImagePath = "examples/1bit.bmp";
    const mockBuffer = Buffer.alloc((800 / 8) * 480, 0xff);
    jest.spyOn(epd, "loadImageInBuffer").mockResolvedValue(mockBuffer);

    const buffer = await epd.loadImageInBuffer(mockImagePath);
    expect(buffer).toEqual(mockBuffer);
  });

  test("should clean up resources", () => {
    epd.cleanup();
    expect(lgpio.gpioWrite).toHaveBeenCalledWith(0, 18, false);
    expect(lgpio.gpiochipClose).toHaveBeenCalledWith(0);
    expect(lgpio.spiClose).toHaveBeenCalledWith(1);
  });
});
