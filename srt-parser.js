class SRTParser {
  static parse(srtContent) {
    const subtitles = [];
    const blocks = srtContent.trim().split(/\n\s*\n/);

    blocks.forEach((block) => {
      const lines = block.trim().split("\n");
      if (lines.length >= 3) {
        const index = parseInt(lines[0]);
        const timeString = lines[1];
        const text = lines.slice(2).join("\n");

        const timeMatch = timeString.match(
          /(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/
        );
        if (timeMatch) {
          const startTime = this.timeToSeconds(
            timeMatch[1],
            timeMatch[2],
            timeMatch[3],
            timeMatch[4]
          );
          const endTime = this.timeToSeconds(
            timeMatch[5],
            timeMatch[6],
            timeMatch[7],
            timeMatch[8]
          );

          subtitles.push({
            index,
            startTime,
            endTime,
            text: text.replace(/<[^>]*>/g, ""), // Remove HTML tags
          });
        }
      }
    });

    return subtitles;
  }

  static timeToSeconds(hours, minutes, seconds, milliseconds) {
    return (
      parseInt(hours) * 3600 +
      parseInt(minutes) * 60 +
      parseInt(seconds) +
      parseInt(milliseconds) / 1000
    );
  }
}
