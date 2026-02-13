import { markdownToAdf } from '../jira/adf-converter.js';

describe('markdownToAdf', () => {
  it('should convert a simple paragraph', () => {
    const result = markdownToAdf('Hello world');
    expect(result).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world' }],
        },
      ],
    });
  });

  it('should convert a bullet list with - prefix', () => {
    const result = markdownToAdf('- Item one\n- Item two');
    expect(result).toEqual({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Item one' }] },
              ],
            },
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Item two' }] },
              ],
            },
          ],
        },
      ],
    });
  });

  it('should convert a bullet list with * prefix', () => {
    const result = markdownToAdf('* Alpha\n* Beta');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('bulletList');
    expect(result.content[0].content).toHaveLength(2);
    expect(result.content[0].content![0].content![0].content![0].text).toBe('Alpha');
  });

  it('should convert mixed paragraphs and lists', () => {
    const md = 'Introduction\n- Point A\n- Point B\nConclusion';
    const result = markdownToAdf(md);

    expect(result.content).toHaveLength(3);
    expect(result.content[0].type).toBe('paragraph');
    expect(result.content[0].content![0].text).toBe('Introduction');
    expect(result.content[1].type).toBe('bulletList');
    expect(result.content[1].content).toHaveLength(2);
    expect(result.content[2].type).toBe('paragraph');
    expect(result.content[2].content![0].text).toBe('Conclusion');
  });

  it('should return a doc with empty paragraph for empty string', () => {
    const result = markdownToAdf('');
    expect(result).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '' }],
        },
      ],
    });
  });

  it('should skip blank lines between paragraphs', () => {
    const result = markdownToAdf('First\n\nSecond');
    expect(result.content).toHaveLength(2);
    expect(result.content[0].content![0].text).toBe('First');
    expect(result.content[1].content![0].text).toBe('Second');
  });

  it('should handle a trailing list without closing paragraph', () => {
    const result = markdownToAdf('Header\n- item');
    expect(result.content).toHaveLength(2);
    expect(result.content[0].type).toBe('paragraph');
    expect(result.content[1].type).toBe('bulletList');
    expect(result.content[1].content).toHaveLength(1);
  });

  it('should strip the 2-char prefix from list items', () => {
    const result = markdownToAdf('- Hello world');
    const listItem = result.content[0].content![0];
    const paragraph = listItem.content![0];
    expect(paragraph.content![0].text).toBe('Hello world');
  });
});
