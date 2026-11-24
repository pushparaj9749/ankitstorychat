import React from 'react';
import { LegalDoc } from './Legal';
import { PRIVACY_SECTIONS, PRIVACY_UPDATED } from '../legal/privacy';

export function Privacy() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated={PRIVACY_UPDATED}
      sections={PRIVACY_SECTIONS}
      footer="Privacy questions? Write to ytdjbhai34@gmail.com."
    />
  );
}
