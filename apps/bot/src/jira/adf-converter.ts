export interface AdfNode {
  type: string;
  text?: string;
  content?: AdfNode[];
}

export function markdownToAdf(markdown: string): AdfNode {
  const lines = markdown.split('\n');
  const content: AdfNode[] = [];
  let currentList: AdfNode | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!currentList) {
        currentList = { type: 'bulletList', content: [] };
      }
      const listContent = currentList.content ?? [];
      listContent.push({
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: trimmed.slice(2) }],
          },
        ],
      });
      currentList.content = listContent;
    } else {
      if (currentList) {
        content.push(currentList);
        currentList = null;
      }
      if (trimmed.length > 0) {
        content.push({
          type: 'paragraph',
          content: [{ type: 'text', text: trimmed }],
        });
      }
    }
  }

  if (currentList) {
    content.push(currentList);
  }

  if (content.length === 0) {
    content.push({
      type: 'paragraph',
      content: [{ type: 'text', text: '' }],
    });
  }

  return {
    type: 'doc',
    content,
  };
}
