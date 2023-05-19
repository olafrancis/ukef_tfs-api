import { Injectable } from '@nestjs/common';
import { ENUMS, PROPERTIES } from '@ukef/constants';
import { DateString, UkefId } from '@ukef/helpers';
import { AcbsFacilityLoanService } from '@ukef/modules/acbs/acbs-facility-loan.service';
import { AcbsAuthenticationService } from '@ukef/modules/acbs-authentication/acbs-authentication.service';
import { DateStringTransformations } from '@ukef/modules/date/date-string.transformations';

import { AcbsBundleInformationService } from '../acbs/acbs-bundle-information.service';
import { BundleActionNewLoanRequest } from '../acbs/dto/bundle-actions/bundle-action-newLoanRequest';
import { CurrentDateProvider } from '../date/current-date.provider';
import { CreateFacilityLoanResponseDto } from './dto/create-facility-loan-response.dto';
import { GetFacilityLoanResponseDto } from './dto/get-facility-loan-response.dto';
import { FacilityLoanToCreate } from './facility-loan-to-create.interface';

@Injectable()
export class FacilityLoanService {
  constructor(
    private readonly acbsAuthenticationService: AcbsAuthenticationService,
    private readonly acbsFacilityLoanService: AcbsFacilityLoanService,
    private readonly acbsBundleInformationService: AcbsBundleInformationService,
    private readonly dateStringTransformations: DateStringTransformations,
    private readonly currentDateProvider: CurrentDateProvider,
  ) {}

  async getLoansForFacility(facilityIdentifier: string): Promise<GetFacilityLoanResponseDto> {
    const { portfolioIdentifier } = PROPERTIES.GLOBAL;
    const idToken = await this.acbsAuthenticationService.getIdToken();
    const loansInAcbs = await this.acbsFacilityLoanService.getLoansForFacility(portfolioIdentifier, facilityIdentifier, idToken);
    return loansInAcbs.map((loan) => {
      return {
        portfolioIdentifier: loan.PortfolioIdentifier,
        loanIdentifier: loan.LoanIdentifier,
        facilityIdentifier: loan.ParentFacilityIdentifier,
        borrowerPartyIdentifier: loan.PrimaryParty.PartyIdentifier,
        productTypeId: loan.ProductType.ProductTypeCode,
        productTypeGroup: loan.ProductGroup.ProductGroupCode,
        currency: loan.Currency.CurrencyCode,
        issueDate: this.dateStringTransformations.removeTime(loan.EffectiveDate),
        expiryDate: this.dateStringTransformations.removeTime(loan.MaturityDate),
        principalBalance: loan.PrincipalBalance,
        interestBalance: loan.InterestBalance,
        feeBalance: loan.FeeBalance,
        otherBalance: loan.OtherBalance,
        discountedPrincipal: loan.DiscountedPrincipal,
      };
    });
  }

  async createLoanForFacility(facilityIdentifier: UkefId, newFacilityLoan: FacilityLoanToCreate): Promise<CreateFacilityLoanResponseDto> {
    const idToken = await this.acbsAuthenticationService.getIdToken();

    const bundleMessage: BundleActionNewLoanRequest = {
      ...this.getBaseMessage(facilityIdentifier, newFacilityLoan),
      ...this.getDealCustomerUsageRate(newFacilityLoan),
      ...this.getDealCustomerUsageOperationType(newFacilityLoan),
      ...this.getFieldsThatDependOnGbp(newFacilityLoan),
    };

    const bundleInformationToCreateInAcbs = {
      PortfolioIdentifier: PROPERTIES.GLOBAL.portfolioIdentifier,
      InitiatingUserName: PROPERTIES.FACILITY_LOAN.DEFAULT.initiatingUserName,
      ServicingUserAccountIdentifier: PROPERTIES.FACILITY_LOAN.DEFAULT.servicingUserAccountIdentifier,
      UseAPIUserIndicator: PROPERTIES.FACILITY_LOAN.DEFAULT.useAPIUserIndicator,
      InitialBundleStatusCode: PROPERTIES.FACILITY_LOAN.DEFAULT.initialBundleStatusCode,
      PostingDate: this.dateStringTransformations.addTimeToDateOnlyString(newFacilityLoan.postingDate),
      BundleMessageList: [bundleMessage],
    };

    const response = await this.acbsBundleInformationService.createBundleInformation(bundleInformationToCreateInAcbs, idToken);
    return { bundleIdentifier: response.BundleIdentifier };
  }

  private getBaseMessage(facilityIdentifier: UkefId, newFacilityLoan: FacilityLoanToCreate): BundleActionNewLoanRequest {
    let loanInstrumentCode;
    if (newFacilityLoan.productTypeGroup === ENUMS.PRODUCT_TYPE_GROUPS.GEF) {
      loanInstrumentCode = ENUMS.PRODUCT_TYPE_IDS.GEF_CASH;
    } else if (newFacilityLoan.productTypeGroup === ENUMS.PRODUCT_TYPE_GROUPS.BOND) {
      loanInstrumentCode = ENUMS.PRODUCT_TYPE_IDS.BSS;
    } else {
      loanInstrumentCode = ENUMS.PRODUCT_TYPE_IDS.EWCS;
    }

    const issueDateString = this.getIssueDateToCreate(newFacilityLoan);

    return {
      $type: PROPERTIES.FACILITY_LOAN.DEFAULT.messageType,
      FacilityIdentifier: facilityIdentifier,
      BorrowerPartyIdentifier: newFacilityLoan.borrowerPartyIdentifier,
      SectionIdentifier: PROPERTIES.FACILITY_LOAN.DEFAULT.sectionIdentifier,
      LoanInstrumentCode: loanInstrumentCode,
      Currency: {
        CurrencyCode: newFacilityLoan.currency,
      },
      LoanAmount: newFacilityLoan.amount,
      EffectiveDate: issueDateString,
      RateSettingDate: issueDateString,
      RateMaturityDate: this.dateStringTransformations.addTimeToDateOnlyString(newFacilityLoan.expiryDate),
      MaturityDate: this.dateStringTransformations.addTimeToDateOnlyString(newFacilityLoan.expiryDate),
      ServicingUser: {
        UserAcbsIdentifier: PROPERTIES.FACILITY_LOAN.DEFAULT.servicingUser.userAcbsIdentifier,
        UserName: PROPERTIES.FACILITY_LOAN.DEFAULT.servicingUser.userName,
      },
      AdministrativeUser: {
        UserAcbsIdentifier: PROPERTIES.FACILITY_LOAN.DEFAULT.administrativeUser.userAcbsIdentifier,
        UserName: PROPERTIES.FACILITY_LOAN.DEFAULT.administrativeUser.userName,
      },
      ServicingUnit: {
        ServicingUnitIdentifier: PROPERTIES.FACILITY_LOAN.DEFAULT.servicingUnit.servicingUnitIdentifier,
      },
      ServicingUnitSection: {
        ServicingUnitSectionIdentifier: PROPERTIES.FACILITY_LOAN.DEFAULT.servicingUnitSection.servicingUnitSectionIdentifier,
      },
      ClosureType: {
        ClosureTypeCode: PROPERTIES.FACILITY_LOAN.DEFAULT.closureType.closureTypeCode,
      },
      AgentPartyIdentifier: PROPERTIES.FACILITY_LOAN.DEFAULT.agentPartyIdentifier,
      AgentAddressIdentifier: PROPERTIES.FACILITY_LOAN.DEFAULT.agentAddressIdentifier,
      InterestRateType: {
        InterestRateTypeCode: PROPERTIES.FACILITY_LOAN.DEFAULT.interestRateType.interestRateTypeCode,
      },
      BookingType: {
        LoanBookingTypeCode: PROPERTIES.FACILITY_LOAN.DEFAULT.bookingType.loanBookingTypeCode,
      },
      LoanReviewFrequencyType: {
        LoanReviewFrequencyTypeCode: PROPERTIES.FACILITY_LOAN.DEFAULT.loanReviewFrequencyType.loanReviewFrequencyTypeCode,
      },
      CurrentRiskOfficerIdentifier: PROPERTIES.FACILITY_LOAN.DEFAULT.currentRiskOfficerIdentifier,
      ProductGroup: {
        ProductGroupCode: newFacilityLoan.productTypeGroup,
      },
      ProductType: {
        ProductTypeCode: newFacilityLoan.productTypeId,
      },
      LoanAdvanceType: {
        LoanAdvanceTypeCode: PROPERTIES.FACILITY_LOAN.DEFAULT.loanAdvanceType.loanAdvanceTypeCode,
      },
      GeneralLedgerUnit: {
        GeneralLedgerUnitIdentifier: PROPERTIES.FACILITY_LOAN.DEFAULT.generalLedgerUnit.generalLedgerUnitIdentifier,
      },
      CashEventList: [
        {
          PaymentInstructionCode: PROPERTIES.FACILITY_LOAN.DEFAULT.cashEventList.paymentInstructionCode,
          CashOffsetTypeCode: PROPERTIES.FACILITY_LOAN.DEFAULT.cashEventList.cashOffsetTypeCode,
          Currency: {
            CurrencyCode: newFacilityLoan.currency,
          },
          SettlementCurrencyCode: PROPERTIES.FACILITY_LOAN.DEFAULT.cashEventList.settlementCurrencyCode,
          OriginatingGeneralLedgerUnit: PROPERTIES.FACILITY_LOAN.DEFAULT.cashEventList.originatingGeneralLedgerUnit,
          DDAAccount: PROPERTIES.FACILITY_LOAN.DEFAULT.cashEventList.dDAAccount,
          CashDetailAmount: newFacilityLoan.amount,
          CashReferenceIdentifier: PROPERTIES.FACILITY_LOAN.DEFAULT.cashEventList.cashReferenceIdentifier,
        },
      ],
      SecuredType: {
        LoanSecuredTypeCode: PROPERTIES.FACILITY_LOAN.DEFAULT.securedType.loanSecuredTypeCode,
      },
    };
  }

  private getDealCustomerUsageRate(newFacilityLoan: FacilityLoanToCreate) {
    return newFacilityLoan.dealCustomerUsageRate ? { DealCustomerUsageRate: newFacilityLoan.dealCustomerUsageRate } : {};
  }

  private getDealCustomerUsageOperationType(newFacilityLoan: FacilityLoanToCreate) {
    const operationTypeCode =
      newFacilityLoan.dealCustomerUsageOperationType && newFacilityLoan.dealCustomerUsageOperationType === ENUMS.OPERATION_TYPE_CODES.DIVIDE
        ? ENUMS.OPERATION_TYPE_CODES.DIVIDE
        : ENUMS.OPERATION_TYPE_CODES.MULTIPLY;
    return newFacilityLoan.dealCustomerUsageOperationType
      ? {
          DealCustomerUsageOperationType: {
            OperationTypeCode: operationTypeCode,
          },
        }
      : {};
  }

  private getFieldsThatDependOnGbp(newFacilityLoan: FacilityLoanToCreate) {
    const isNotGbp = newFacilityLoan.currency !== 'GBP';
    return isNotGbp
      ? {
          FinancialRateGroup: PROPERTIES.FACILITY_LOAN.DEFAULT.financialRateGroup,
          CustomerUsageRateGroup: PROPERTIES.FACILITY_LOAN.DEFAULT.customerUsageRateGroup,
          FinancialFrequency: {
            UsageFrequencyTypeCode: PROPERTIES.FACILITY_LOAN.DEFAULT.financialFrequency.usageFrequencyTypeCode,
          },
          CustomerUsageFrequency: {
            UsageFrequencyTypeCode: PROPERTIES.FACILITY_LOAN.DEFAULT.customerUsageFrequency.usageFrequencyTypeCode,
          },
          FinancialBusinessDayAdjustment: {
            BusinessDayAdjustmentTypeCode: PROPERTIES.FACILITY_LOAN.DEFAULT.financialBusinessDayAdjustment.businessDayAdjustmentTypeCode,
          },
          CustomerUsageBusinessDayAdjustment: {
            BusinessDayAdjustmentTypeCode: PROPERTIES.FACILITY_LOAN.DEFAULT.customerUsageBusinessDayAdjustment.businessDayAdjustmentTypeCode,
          },
          FinancialCalendar: {
            CalendarIdentifier: PROPERTIES.FACILITY_LOAN.DEFAULT.financialCalendar.calendarIdentifier,
          },
          CustomerUsageCalendar: {
            CalendarIdentifier: PROPERTIES.FACILITY_LOAN.DEFAULT.customerUsageCalendar.calendarIdentifier,
          },
          FinancialNextValuationDate: this.dateStringTransformations.addTimeToDateOnlyString(newFacilityLoan.expiryDate),
          CustomerUsageNextValuationDate: this.dateStringTransformations.addTimeToDateOnlyString(newFacilityLoan.expiryDate),
          FinancialLockMTMRateIndicator: PROPERTIES.FACILITY_LOAN.DEFAULT.financialLockMTMRateIndicator,
          CustomerUsageLockMTMRateIndicator: PROPERTIES.FACILITY_LOAN.DEFAULT.customerUsageLockMTMRateIndicator,
        }
      : {};
  }

  private getIssueDateToCreate(facilityLoanToCreate: FacilityLoanToCreate): DateString {
    const issueDateTime = this.currentDateProvider.getEarliestDateFromTodayAnd(
      new Date(this.dateStringTransformations.addTimeToDateOnlyString(facilityLoanToCreate.issueDate)),
    );
    return this.dateStringTransformations.getDateStringFromDate(issueDateTime);
  }
}
