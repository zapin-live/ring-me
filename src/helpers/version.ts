const hash = (text: string) => {
  let result = 0;
  for (let i = 0, len = text.length; i < len; i++) {
    let chr = text.charCodeAt(i);
    result = (result << 5) - result + chr;
    result |= 0;
  }
  return result;
}

export const getVersionHash = async () => {
  const highEntropyValues = await (navigator as any)?.userAgentData?.getHighEntropyValues(['fullVersionList']);
  const versionDump = JSON.stringify([...(highEntropyValues ? highEntropyValues.fullVersionList : []), navigator.userAgent])
  return hash(versionDump);
}
