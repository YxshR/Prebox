"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionStatus = exports.CampaignStatus = exports.SubscriptionTier = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["USER"] = "user";
    UserRole["ADMIN"] = "admin";
    UserRole["SUPER_ADMIN"] = "super_admin";
})(UserRole || (exports.UserRole = UserRole = {}));
var SubscriptionTier;
(function (SubscriptionTier) {
    SubscriptionTier["FREE"] = "free";
    SubscriptionTier["PAID_STANDARD"] = "paid_standard";
    SubscriptionTier["PREMIUM"] = "premium";
    SubscriptionTier["ENTERPRISE"] = "enterprise";
})(SubscriptionTier || (exports.SubscriptionTier = SubscriptionTier = {}));
var CampaignStatus;
(function (CampaignStatus) {
    CampaignStatus["DRAFT"] = "draft";
    CampaignStatus["SCHEDULED"] = "scheduled";
    CampaignStatus["SENDING"] = "sending";
    CampaignStatus["SENT"] = "sent";
    CampaignStatus["PAUSED"] = "paused";
    CampaignStatus["FAILED"] = "failed";
})(CampaignStatus || (exports.CampaignStatus = CampaignStatus = {}));
var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus["SUBSCRIBED"] = "subscribed";
    SubscriptionStatus["UNSUBSCRIBED"] = "unsubscribed";
    SubscriptionStatus["BOUNCED"] = "bounced";
    SubscriptionStatus["COMPLAINED"] = "complained";
})(SubscriptionStatus || (exports.SubscriptionStatus = SubscriptionStatus = {}));
//# sourceMappingURL=index.js.map