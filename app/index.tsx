import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth';

export default function Index() {
  const { status } = useAuth();
  return <Redirect href={status === 'signedIn' ? '/trips' : '/auth'} />;
}
