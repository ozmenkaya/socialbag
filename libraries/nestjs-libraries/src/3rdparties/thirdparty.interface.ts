import { Injectable } from '@nestjs/common';

export abstract class ThirdPartyAbstract<T = any> {
  abstract checkConnection(
    apiKey: string
  ): Promise<false | { name: string; username: string; id: string }>;
  abstract sendData(apiKey: string, data: T): Promise<string>;
  [key: string]: ((apiKey: string, data?: any) => Promise<any>) | undefined;
}
// read by the method named in `balance.function`: false when the platform
// refuses to tell
export type ThirdPartyBalance = false | { amount: number; unit: 'usd' | 'credits' };

export interface ThirdPartyParams {
  identifier: string;
  title: string;
  description: string;
  // where a connected integration shows up in the post editor
  position?: 'media' | 'media-library' | 'webhook';
  fields: {
    name: string;
    description: string;
    type: string;
    placeholder: string;
    validation?: RegExp;
  }[];
  // One option the user picks after connecting (for example a model): the
  // provider method `function` lists the possible values
  choice?: {
    title: string;
    function: string;
    // used until the user picks one
    default: string;
  };
  // What is left on the account, shown next to the connected integration:
  // the provider method `function` reads it without spending anything and
  // returns { amount, unit } (false when it can't), `url` opens the billing
  // page of a platform that does not expose it, or when the read fails
  balance?: { function?: string; url?: string };
  // An integration installed on the other platform instead of connected here
  // with an API key: the list opens this link. undefined hides it
  installUrl?: () => string | undefined;
}

export function ThirdParty(params: ThirdPartyParams) {
  return function (target: any) {
    // Apply @Injectable decorator to the target class
    Injectable()(target);

    // Retrieve existing metadata or initialize an empty array
    const existingMetadata =
      Reflect.getMetadata('third:party', ThirdPartyAbstract) || [];

    // Add the metadata information for this method
    existingMetadata.push({ target, ...params });

    // Define metadata on the class prototype (so it can be retrieved from the class)
    Reflect.defineMetadata('third:party', existingMetadata, ThirdPartyAbstract);
  };
}
