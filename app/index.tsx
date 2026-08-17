import { Redirect } from 'expo-router';
import React from 'react';

import { useMinoStore } from '@/store/useMinoStore';

/** Entry point: no family yet → welcome, otherwise → profile picker. */
export default function Index() {
  const data = useMinoStore((s) => s.data);
  return <Redirect href={data ? '/who' : '/welcome'} />;
}
