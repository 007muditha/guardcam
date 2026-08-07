const RNFS = {
  DocumentDirectoryPath: '/mock/documents',
  CachesDirectoryPath: '/mock/caches',
  readFile: async (path: string, encoding?: string) => '',
  writeFile: async (path: string, content: string, encoding?: string) => {},
  exists: async (path: string) => false,
  unlink: async (path: string) => {},
  getFSInfo: async () => ({ totalSpace: 64000000000, freeSpace: 32000000000 }),
};

export default RNFS;
