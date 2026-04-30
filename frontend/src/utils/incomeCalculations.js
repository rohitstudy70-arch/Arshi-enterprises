const toNumber = (value) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

export const calculateDues = (billAmount, receivedAmount) => {
  return toNumber(billAmount) - toNumber(receivedAmount);
};
