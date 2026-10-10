import {
  avatarRow,
  initialOf,
  type MemberLike,
  memberLabel,
  memberRoleLine,
  sortMembers,
  toMember,
} from './members';

const member = (name: string, extra: Partial<MemberLike> = {}): MemberLike => ({
  name,
  role: 'member',
  isMe: false,
  ...extra,
});

describe('initialOf', () => {
  it('is the first letter, upper-cased, ignoring spaces around the name', () => {
    expect(initialOf('Blake')).toBe('B');
    expect(initialOf('  willem ')).toBe('W');
    expect(initialOf('élodie')).toBe('É');
  });

  it('keeps a character outside the basic plane whole, and is "?" for no name', () => {
    expect(initialOf('𝓩oe')).toBe('𝓩');
    expect(initialOf('')).toBe('?');
    expect(initialOf('   ')).toBe('?');
  });
});

describe('toMember', () => {
  it('names a member with their initial, or "Traveller" without a name', () => {
    expect(toMember('u2', ' Blake ', 'member', false)).toEqual({
      id: 'u2',
      name: 'Blake',
      initial: 'B',
      role: 'member',
      isMe: false,
    });
    expect(toMember('u3', null, 'owner', true)).toMatchObject({ name: 'Traveller', initial: 'T' });
    expect(toMember('u4', '  ', 'member', false).name).toBe('Traveller');
  });
});

describe('memberLabel', () => {
  it('is "You" for yourself and the name for anyone else', () => {
    expect(memberLabel(member('Matthew', { isMe: true, role: 'owner' }))).toBe('You');
    expect(memberLabel(member('Blake'))).toBe('Blake');
  });
});

describe('sortMembers', () => {
  it('puts you first, then the owner, then the rest by name', () => {
    const sorted = sortMembers([
      member('willem'),
      member('Owen', { role: 'owner' }),
      member('Blake'),
      member('Matthew', { isMe: true }),
    ]);
    expect(sorted.map((m) => m.name)).toEqual(['Matthew', 'Owen', 'Blake', 'willem']);
  });

  it('puts you first when you are the owner, and leaves the input alone', () => {
    const input = [member('Blake'), member('Matthew', { isMe: true, role: 'owner' })];
    expect(sortMembers(input).map((m) => m.name)).toEqual(['Matthew', 'Blake']);
    expect(input[0].name).toBe('Blake');
  });
});

describe('avatarRow', () => {
  const m = (name: string, isMe = false, role: 'owner' | 'member' = 'member') => ({
    name,
    role,
    isMe,
  });
  const names = (row: { shown: { name: string }[]; more: number }) => [
    row.shown.map((x) => x.name),
    row.more,
  ];

  it('is empty when you are alone on the trip', () => {
    expect(avatarRow([m('Matthew', true, 'owner')])).toEqual({ shown: [], more: 0 });
    expect(avatarRow([])).toEqual({ shown: [], more: 0 });
  });

  it('puts you last, after everyone else in order', () => {
    expect(names(avatarRow([m('Matthew', true, 'owner'), m('Blake'), m('Willem')]))).toEqual([
      ['Blake', 'Willem', 'Matthew'],
      0,
    ]);
  });

  it('shows four circles at most, you among them, and counts the rest', () => {
    const six = [m('You', true), m('A', false, 'owner'), m('B'), m('C'), m('D'), m('E')];
    expect(names(avatarRow(six))).toEqual([['A', 'B', 'C', 'You'], 2]);
    expect(names(avatarRow(six.slice(0, 4)))).toEqual([['A', 'B', 'C', 'You'], 0]);
  });
});

describe('memberRoleLine', () => {
  it('names the organizer and you', () => {
    expect(memberRoleLine({ name: 'Matthew', role: 'owner', isMe: true })).toBe('Organizer · You');
    expect(memberRoleLine({ name: 'Blake', role: 'owner', isMe: false })).toBe('Organizer');
    expect(memberRoleLine({ name: 'Willem', role: 'member', isMe: true })).toBe('You');
    expect(memberRoleLine({ name: 'Blake', role: 'member', isMe: false })).toBe('');
  });
});
