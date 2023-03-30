import { HttpModule } from '@nestjs/axios';
import { CacheModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AcbsAuthenticationService } from './acbs-authentication.service';
import { BaseAcbsAuthenticationService } from './base-acbs-authentication.service';
import { CachingAcbsAuthenticationService } from './caching-acbs-authentication.service';

const acbsAuthenticationServiceProvider = {
  provide: AcbsAuthenticationService,
  useClass: CachingAcbsAuthenticationService,
};

@Module({
  imports: [
    CacheModule.register(),
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        maxRedirects: configService.get<number>('acbs.maxRedirects'),
        timeout: configService.get<number>('acbs.timeout'), // TODO APIM-164: Add separate timeout for ACBS Authentication
      }),
    }),
  ],
  providers: [BaseAcbsAuthenticationService, acbsAuthenticationServiceProvider],
  exports: [acbsAuthenticationServiceProvider],
})
export class AcbsAuthenticationModule {}
