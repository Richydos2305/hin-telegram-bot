function add(a: number, b: number): number {
  return a + b;
}

describe('add', () => {
  it('should return the sum of two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('should return 0 when adding 0 + 0', () => {
    expect(add(0, 0)).toBe(0);
  });
});
