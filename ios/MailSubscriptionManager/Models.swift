import Foundation
import SwiftUI

enum MailProvider: String, CaseIterable, Codable, Identifiable {
    case gmail = "Gmail"
    case outlook = "Outlook"
    case iCloud = "iCloud"
    case yahoo = "Yahoo! Mail"

    var id: String { rawValue }

    var tint: Color {
        switch self {
        case .gmail: return .red
        case .outlook: return .blue
        case .iCloud: return .cyan
        case .yahoo: return .purple
        }
    }
}

enum SubscriptionCategory: String, CaseIterable, Codable, Identifiable {
    case ads = "広告・セール"
    case newsletter = "ニュースレター"
    case social = "SNS通知"
    case service = "サービス更新"
    case billing = "請求・領収書"
    case personal = "個人・仕事"

    var id: String { rawValue }

    var baseScore: Int {
        switch self {
        case .ads: return 100
        case .newsletter: return 70
        case .social: return 60
        case .service: return 30
        case .billing, .personal: return 0
        }
    }

    var isProtected: Bool {
        self == .billing || self == .personal
    }
}

struct MailAccount: Identifiable, Codable, Equatable {
    var id: UUID
    var provider: MailProvider
    var email: String
    var isConnected: Bool
    var syncedAt: Date?

    init(id: UUID = UUID(), provider: MailProvider, email: String, isConnected: Bool = true, syncedAt: Date? = Date()) {
        self.id = id
        self.provider = provider
        self.email = email
        self.isConnected = isConnected
        self.syncedAt = syncedAt
    }
}

struct Subscription: Identifiable, Codable, Equatable {
    var id: UUID
    var accountID: UUID
    var senderName: String
    var senderDomain: String
    var category: SubscriptionCategory
    var lastOpenedDays: Int
    var receiveCount30Days: Int
    var unsubscribedAt: Date?
    var isKept: Bool
    var lastAction: UnsubscribeAction?

    init(
        id: UUID = UUID(),
        accountID: UUID,
        senderName: String,
        senderDomain: String,
        category: SubscriptionCategory,
        lastOpenedDays: Int,
        receiveCount30Days: Int,
        unsubscribedAt: Date? = nil,
        isKept: Bool = false,
        lastAction: UnsubscribeAction? = nil
    ) {
        self.id = id
        self.accountID = accountID
        self.senderName = senderName
        self.senderDomain = senderDomain
        self.category = category
        self.lastOpenedDays = lastOpenedDays
        self.receiveCount30Days = receiveCount30Days
        self.unsubscribedAt = unsubscribedAt
        self.isKept = isKept
        self.lastAction = lastAction
    }
}

enum UnsubscribeAction: String, Codable, Equatable {
    case markSpam
    case trashOnly

    var label: String {
        switch self {
        case .markSpam: return "迷惑メール登録"
        case .trashOnly: return "削除だけ"
        }
    }
}

struct ScoreWeights: Codable, Equatable {
    var opened: Double = 55
    var category: Double = 30
    var frequency: Double = 15

    var normalized: (opened: Double, category: Double, frequency: Double) {
        let total = max(opened + category + frequency, 1)
        return (opened / total, category / total, frequency / total)
    }
}

enum ScoreBand {
    case high
    case medium
    case low

    init(score: Int) {
        if score >= 80 {
            self = .high
        } else if score >= 50 {
            self = .medium
        } else {
            self = .low
        }
    }

    var label: String {
        switch self {
        case .high: return "解除強く推奨"
        case .medium: return "要確認"
        case .low: return "保持推奨"
        }
    }

    var color: Color {
        switch self {
        case .high: return .red
        case .medium: return .orange
        case .low: return .green
        }
    }
}
