import React from 'react';
import { LegalDoc } from './Legal';
import { TERMS_SECTIONS, TERMS_UPDATED } from '../legal/terms';

export function Terms() {
  return (
    <LegalDoc
      title="Terms & Conditions"
      updated={TERMS_UPDATED}
      sections={TERMS_SECTIONS}
      footer="This text is provided as in-app terms for transparency. Professional legal review is recommended before production publication."
    />
  );
}
