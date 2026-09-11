import React from 'react';
import { LegalDoc } from './Legal';
import { PRIVACY_SECTIONS, PRIVACY_UPDATED } from '../legal/privacy';

export function Privacy() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated={PRIVACY_UPDATED}
      sections={PRIVACY_SECTIONS}
      footer="Questions about privacy? Open an issue on the GitHub repository linked in About."
    />
  );
}
