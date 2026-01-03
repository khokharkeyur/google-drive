const StorageBar = ({ used = 0, max = 10 * 1024 * 1024 }) => {
  const usedMB = (used / 1024 / 1024).toFixed(2);
  const maxMB = (max / 1024 / 1024).toFixed(2);
  const remainingMB = ((max - used) / 1024 / 1024).toFixed(2);
  const percent = Math.min((used / max) * 100, 100);

  return (
    <div style={{ marginBottom: "10px", fontFamily: "sans-serif" }}>
      <div>Used: {usedMB} MB</div>
      <div>Remaining: {remainingMB} MB</div>
      <div>Max: {maxMB} MB</div>
    </div>
  );
};

export default StorageBar;
