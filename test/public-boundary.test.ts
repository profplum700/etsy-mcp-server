import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type BoundaryRule = {
  label: string;
  pattern: RegExp;
};

const join = (parts: string[]) => parts.join('');
const escaped = (parts: string[]) => parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');

const brandAcronym = join(['f', 'hah']);
const brandDomain = `${brandAcronym}${escaped(['.', 'tools'])}`;
const brandPhrase = ['for', 'him', 'and', 'him'];
const tradingProject = join(['etsy', '-', 'trading', '-', 'manager']);

const forbiddenBoundaryRules: BoundaryRule[] = [
  {
    label: 'shop-specific acronym',
    pattern: new RegExp(escaped([brandAcronym]), 'i'),
  },
  {
    label: 'shop-specific domain',
    pattern: new RegExp(brandDomain, 'i'),
  },
  {
    label: 'shop-specific display name',
    pattern: new RegExp(brandPhrase.map((word) => escaped([word])).join('[\\s_-]+'), 'i'),
  },
  {
    label: 'shop-specific compact display name',
    pattern: new RegExp(escaped(brandPhrase), 'i'),
  },
  {
    label: 'internal planning project name',
    pattern: new RegExp(escaped([tradingProject]), 'i'),
  },
  {
    label: 'machine-local project path',
    pattern: new RegExp(escaped(['/', 'data', '/', 'projects']), 'i'),
  },
  {
    label: 'internal machine name',
    pattern: new RegExp(escaped(['ai', '-', 'machine']), 'i'),
  },
  {
    label: 'internal deployment provider reference',
    pattern: new RegExp(escaped(['ver', 'cel']), 'i'),
  },
  {
    label: 'internal data service reference',
    pattern: new RegExp(escaped(['supa', 'base']), 'i'),
  },
  {
    label: 'internal app-host domain',
    pattern: new RegExp(escaped(['fly', '.', 'dev']), 'i'),
  },
  {
    label: 'internal worker-host domain',
    pattern: new RegExp(escaped(['workers', '.', 'dev']), 'i'),
  },
  {
    label: 'operator-specific name',
    pattern: new RegExp(escaped(['hen', 'ry']), 'i'),
  },
];

const textFileExtensions = new Set([
  '.cjs',
  '.css',
  '.dockerignore',
  '.env',
  '.example',
  '.gitignore',
  '.json',
  '.lock',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.txt',
  '.yml',
]);

function trackedTextFiles(): string[] {
  return execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean)
    .filter((filePath) => !filePath.startsWith('build/'))
    .filter((filePath) => {
      const basename = path.basename(filePath);
      return textFileExtensions.has(path.extname(filePath)) || textFileExtensions.has(basename);
    });
}

describe('public repository boundary', () => {
  it('does not contain shop-specific names, internal hosts, or local deployment references', () => {
    const violations: string[] = [];

    for (const filePath of trackedTextFiles()) {
      const content = readFileSync(filePath, 'utf8');

      for (const rule of forbiddenBoundaryRules) {
        if (rule.pattern.test(content)) {
          violations.push(`${filePath}: ${rule.label}`);
        }
      }
    }

    expect(
      violations,
      violations.length
        ? `Public-boundary violations found:\n${violations.join('\n')}`
        : 'No public-boundary violations found'
    ).toHaveLength(0);
  });
});
