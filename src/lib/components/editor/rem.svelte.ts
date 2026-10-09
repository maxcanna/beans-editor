const read = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

let size = $state(read());
window.addEventListener('resize', () => (size = read()));

/**
 * The size of 1rem in pixels, for the virtual lists, which place rows by arithmetic. Sizing their rows
 * in rem keeps them in step with the text when the user raises the system font size.
 */
export const rem = {
  get px(): number {
    return size;
  },
};
