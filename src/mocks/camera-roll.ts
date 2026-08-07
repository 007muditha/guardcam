export const CameraRoll = {
  save: async (uri: string, options?: any) => uri,
  getPhotos: async () => ({ edges: [], page_info: { has_next_page: false } }),
};
export default { CameraRoll };
