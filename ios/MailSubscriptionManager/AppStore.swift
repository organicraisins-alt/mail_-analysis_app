import Foundation

@MainActor
final class AppStore: ObservableObject {
    @Published var accounts: [MailAccount] = []
    @Published var subscriptions: [Subscription] = []
    @Published var weights = ScoreWeights()

    private let storageKey = "mail-subscription-manager-ios-state"

    init() {
        load()
    }

    var activeSubscriptions: [Subscription] {
        subscriptions.filter { $0.unsubscribedAt == nil }
    }

    var unsubscribedSubscriptions: [Subscription] {
        subscriptions.filter { $0.unsubscribedAt != nil }
    }

    var highRecommendationCount: Int {
        activeSubscriptions.filter { $0.receiveCount30Days >= 20 }.count
    }

    var savedMailCount: Int {
        unsubscribedSubscriptions.reduce(0) { $0 + $1.receiveCount30Days }
    }

    var estimatedTimeSavedMinutes: Int {
        Int(Double(savedMailCount) * 0.35)
    }

    func account(for subscription: Subscription) -> MailAccount? {
        accounts.first { $0.id == subscription.accountID }
    }

    func groupedCount(for subscription: Subscription) -> Int {
        subscriptions.filter { $0.senderDomain == subscription.senderDomain }.count
    }

    func score(for subscription: Subscription) -> Int {
        if subscription.isKept || subscription.category.isProtected {
            return 0
        }

        let normalized = weights.normalized
        let score = Double(openedScore(days: subscription.lastOpenedDays)) * normalized.opened
            + Double(subscription.category.baseScore) * normalized.category
            + Double(frequencyScore(count: subscription.receiveCount30Days)) * normalized.frequency

        return Int(score.rounded())
    }

    func unsubscribe(_ subscription: Subscription, action: UnsubscribeAction = .trashOnly) {
        guard let index = subscriptions.firstIndex(where: { $0.id == subscription.id }) else { return }
        subscriptions[index].unsubscribedAt = Date()
        subscriptions[index].isKept = false
        subscriptions[index].lastAction = action
        save()
    }

    func keep(_ subscription: Subscription) {
        guard let index = subscriptions.firstIndex(where: { $0.id == subscription.id }) else { return }
        subscriptions[index].isKept = true
        save()
    }

    func restore(_ subscription: Subscription) {
        guard let index = subscriptions.firstIndex(where: { $0.id == subscription.id }) else { return }
        subscriptions[index].unsubscribedAt = nil
        subscriptions[index].lastAction = nil
        save()
    }

    func syncAll() {
        for index in accounts.indices {
            accounts[index].isConnected = true
            accounts[index].syncedAt = Date()
        }
        save()
    }

    func addDemoAccount() {
        guard accounts.count < 10 else { return }
        let next = accounts.count + 1
        accounts.append(MailAccount(provider: .yahoo, email: "demo\(next)@example.com", syncedAt: nil))
        save()
    }

    func updateWeights(opened: Double, category: Double, frequency: Double) {
        weights = ScoreWeights(opened: opened, category: category, frequency: frequency)
        save()
    }

    func resetDemoData() {
        let demo = Self.demoState()
        accounts = demo.accounts
        subscriptions = demo.subscriptions
        weights = demo.weights
        save()
    }

    private func openedScore(days: Int) -> Int {
        if days < 30 { return 0 }
        if days < 90 { return 40 }
        if days < 180 { return 70 }
        return 100
    }

    private func frequencyScore(count: Int) -> Int {
        if count < 4 { return 0 }
        if count <= 12 { return 30 }
        if count <= 30 { return 60 }
        return 100
    }

    private func load() {
        guard
            let data = UserDefaults.standard.data(forKey: storageKey),
            let state = try? JSONDecoder().decode(PersistedState.self, from: data)
        else {
            resetDemoData()
            return
        }

        accounts = state.accounts
        subscriptions = state.subscriptions
        weights = state.weights
    }

    private func save() {
        let state = PersistedState(accounts: accounts, subscriptions: subscriptions, weights: weights)
        guard let data = try? JSONEncoder().encode(state) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)
    }

    private static func demoState() -> PersistedState {
        let gmail = MailAccount(provider: .gmail, email: "main@example.com")
        let outlook = MailAccount(provider: .outlook, email: "work@example.com")
        let iCloud = MailAccount(provider: .iCloud, email: "private@icloud.com", isConnected: false)

        return PersistedState(
            accounts: [gmail, outlook, iCloud],
            subscriptions: [
                Subscription(accountID: gmail.id, senderName: "Daily Deals", senderDomain: "deals.example.jp", category: .ads, lastOpenedDays: 220, receiveCount30Days: 38),
                Subscription(accountID: gmail.id, senderName: "Tech Weekly", senderDomain: "techweekly.example", category: .newsletter, lastOpenedDays: 112, receiveCount30Days: 8),
                Subscription(accountID: outlook.id, senderName: "Cloud Billing", senderDomain: "billing.example.com", category: .billing, lastOpenedDays: 12, receiveCount30Days: 2, isKept: true),
                Subscription(accountID: iCloud.id, senderName: "Social Now", senderDomain: "social.example", category: .social, lastOpenedDays: 74, receiveCount30Days: 21),
                Subscription(accountID: outlook.id, senderName: "Product Updates", senderDomain: "updates.example.io", category: .service, lastOpenedDays: 45, receiveCount30Days: 5),
                Subscription(accountID: gmail.id, senderName: "Daily Deals", senderDomain: "deals.example.jp", category: .ads, lastOpenedDays: 190, receiveCount30Days: 31)
            ],
            weights: ScoreWeights()
        )
    }
}

private struct PersistedState: Codable {
    var accounts: [MailAccount]
    var subscriptions: [Subscription]
    var weights: ScoreWeights
}
