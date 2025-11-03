export default function formatTime(time: number) {
  const pad = (num: number) => num.toString().padStart(2, "0");
  const minutes = pad(Math.floor(time / 60000));
  const seconds = pad(Math.floor((time % 60000) / 1000));
  const milliseconds = pad(time % 1000);
  return `${minutes}:${seconds}:${milliseconds}`;
}
