import { appLink } from './appLink';
import { inviteLink, inviteMessage, isInviteToken, parseInviteLink } from './inviteLink';

const TOKEN = 'Ab3_-xYz0123456789abcd';
const EXPO_GO = `exp://u.expo.dev/0458c1dd-61a0-47f7-ac52-c648b4458fea/--/invite/${TOKEN}?runtime-version=exposdk:57.0.0&channel-name=main`;

describe('inviteLink', () => {
  it('builds the Expo Go link by default', () => {
    expect(inviteLink(TOKEN)).toBe(EXPO_GO);
  });

  it('builds the standalone link', () => {
    expect(inviteLink(TOKEN, 'trip')).toBe(`trip://invite/${TOKEN}`);
  });

  it('refuses a token that would break the link', () => {
    expect(() => inviteLink('a/b?c=d')).toThrow('Not an invite token');
    expect(() => inviteLink('')).toThrow();
  });

  it('shares the scenario links’ form', () => {
    expect(appLink('scenario/x')).toBe(EXPO_GO.replace(`invite/${TOKEN}`, 'scenario/x'));
  });
});

describe('parseInviteLink', () => {
  it('reads both forms back', () => {
    expect(parseInviteLink(EXPO_GO)).toBe(TOKEN);
    expect(parseInviteLink(`trip://invite/${TOKEN}`)).toBe(TOKEN);
    expect(parseInviteLink(`  trip://invite/${TOKEN}/ `)).toBe(TOKEN);
  });

  it('reads the link out of nothing else', () => {
    expect(parseInviteLink(inviteMessage('Las Vegas', EXPO_GO))).toBeNull();
    expect(parseInviteLink('')).toBeNull();
    expect(parseInviteLink('https://example.com/invite/abcdefgh')).toBeNull();
    expect(parseInviteLink(`trip://scenario/${TOKEN}`)).toBeNull();
    expect(parseInviteLink('trip://invite/')).toBeNull();
    expect(parseInviteLink('trip://invite/short')).toBeNull();
    expect(parseInviteLink('trip://invite/has%20space1')).toBeNull();
    expect(parseInviteLink(`trip://invite/${TOKEN}/more`)).toBeNull();
  });
});

describe('isInviteToken', () => {
  it('accepts URL-safe tokens only', () => {
    expect(isInviteToken(TOKEN)).toBe(true);
    expect(isInviteToken('demo-vegas-invite')).toBe(true);
    expect(isInviteToken('a.b')).toBe(false);
  });
});

it('writes the share message', () => {
  expect(inviteMessage('Las Vegas', 'L')).toBe('Join my Las Vegas trip on Trip: L');
});
