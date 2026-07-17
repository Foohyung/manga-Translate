import Tesseract from 'tesseract.js';

async function test() {
  try {
    // Create a dummy image with text "HELLO WORLD"
    const canvas = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAeCAYAAADaW7vzAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACmSURBVGhD7c9BDQAgEMAwMOZf4yE4wMDBP7akm/tq3e6+OwcICwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwt7b+MB/9oB7Q/9+sIAAAAASUVORK5CYII=`; // A small valid PNG image (maybe empty or black, but it won't crash)

    console.log('Running detect...');
    const result = await Tesseract.detect(canvas, { logger: m => console.log(m) });
    console.log('Detect Result:', JSON.stringify(result.data, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}
test();
