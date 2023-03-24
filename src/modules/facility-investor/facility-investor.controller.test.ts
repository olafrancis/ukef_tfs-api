import { RandomValueGenerator } from '@ukef-test/support/generator/random-value-generator';

import { CreateFacilityInvestorRequestItem } from './dto/create-facility-investor-request.dto';
import { CreateFacilityInvestorResponse } from './dto/create-facility-investor-response.dto';
import { FacilityInvestorController } from './facility-investor.controller';
import { FacilityInvestorService } from './facility-investor.service';

describe('FacilityInvestorController', () => {
  const valueGenerator = new RandomValueGenerator();

  let controller: FacilityInvestorController;

  let facilityInvestorServiceCreateInvestorForFacility: jest.Mock;

  beforeEach(() => {
    const facilityInvestorService = new FacilityInvestorService(null, null, null);

    facilityInvestorServiceCreateInvestorForFacility = jest.fn();
    facilityInvestorService.createInvestorForFacility = facilityInvestorServiceCreateInvestorForFacility;

    controller = new FacilityInvestorController(facilityInvestorService);
  });

  describe('createInvestorForFacility', () => {
    const facilityIdentifier = valueGenerator.stringOfNumericCharacters();

    const effectiveDate = '9999-01-02';
    const guaranteeExpiryDate = '9999-12-31';
    const lenderType = valueGenerator.stringOfNumericCharacters();
    const currency = 'GBP';
    const maximumLiability = 12345.6;

    const newFacilityInvestor = new CreateFacilityInvestorRequestItem(
      facilityIdentifier,
      effectiveDate,
      guaranteeExpiryDate,
      currency,
      maximumLiability,
      lenderType,
    );

    it('creates an investor for the facility with the service from the request body', async () => {
      await controller.createInvestorForFacility(facilityIdentifier, [newFacilityInvestor]);

      expect(facilityInvestorServiceCreateInvestorForFacility).toHaveBeenCalledWith(facilityIdentifier, newFacilityInvestor);
    });

    it('returns the facility identifier if creating the investor succeeds', async () => {
      const response = await controller.createInvestorForFacility(facilityIdentifier, [newFacilityInvestor]);

      expect(response).toStrictEqual(new CreateFacilityInvestorResponse(facilityIdentifier));
    });

    it('does NOT include unexpected keys from the request body', async () => {
      const newFacilityInvestorPlusUnexpectedKeys = { ...newFacilityInvestor, unexpectedKey: 'unexpected value' };

      await controller.createInvestorForFacility(facilityIdentifier, [newFacilityInvestorPlusUnexpectedKeys]);

      expect(facilityInvestorServiceCreateInvestorForFacility).toHaveBeenCalledWith(facilityIdentifier, newFacilityInvestor);
    });
  });
});
