<?php

namespace Tests\Feature;

use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

class DeliveryZoneManagementTest extends TestCase
{
    use DatabaseTransactions;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create();

        $this->admin->forceFill([
            'is_admin' => true,
        ])->save();

        $this->actingAs($this->admin, 'sanctum');
    }

    private function uniqueZoneName(string $prefix = 'Test Zone'): string
    {
        return $prefix . ' ' . Str::upper(Str::random(8));
    }

    public function test_admin_can_create_delivery_zone(): void
    {
        $name = $this->uniqueZoneName();

        $response = $this->postJson('/api/admin/delivery-zones', [
            'name' => $name,
            'description' => 'Test delivery area',
            'delivery_fee' => 15.50,
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', $name)
            ->assertJsonPath('data.delivery_fee', '15.50');

        $this->assertDatabaseHas('delivery_zones', [
            'name' => $name,
            'delivery_fee' => '15.50',
            'is_active' => 1,
        ]);
    }

    public function test_admin_can_view_all_delivery_zones_including_inactive_ones(): void
    {
        $activeName = $this->uniqueZoneName('Active');
        $inactiveName = $this->uniqueZoneName('Inactive');

        DeliveryZone::create([
            'name' => $activeName,
            'delivery_fee' => 10,
            'is_active' => true,
        ]);

        DeliveryZone::create([
            'name' => $inactiveName,
            'delivery_fee' => 20,
            'is_active' => false,
        ]);

        $response = $this->getJson('/api/admin/delivery-zones');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonFragment(['name' => $activeName])
            ->assertJsonFragment(['name' => $inactiveName]);
    }

    public function test_customer_checkout_only_lists_active_delivery_zones(): void
    {
        $activeName = $this->uniqueZoneName('Checkout Active');
        $inactiveName = $this->uniqueZoneName('Checkout Inactive');

        DeliveryZone::create([
            'name' => $activeName,
            'delivery_fee' => 12.50,
            'is_active' => true,
        ]);

        DeliveryZone::create([
            'name' => $inactiveName,
            'delivery_fee' => 18.00,
            'is_active' => false,
        ]);

        $response = $this->getJson('/api/delivery-zones');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonFragment(['name' => $activeName])
            ->assertJsonMissing(['name' => $inactiveName]);
    }

    public function test_admin_can_update_delivery_zone_details_and_fee(): void
    {
        $zone = DeliveryZone::create([
            'name' => $this->uniqueZoneName('Original'),
            'description' => 'Original description',
            'delivery_fee' => 10,
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $updatedName = $this->uniqueZoneName('Updated');

        $response = $this->putJson(
            "/api/admin/delivery-zones/{$zone->id}",
            [
                'name' => $updatedName,
                'description' => 'Updated description',
                'delivery_fee' => 25.75,
                'sort_order' => 2,
            ]
        );

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', $updatedName)
            ->assertJsonPath('data.delivery_fee', '25.75');

        $this->assertDatabaseHas('delivery_zones', [
            'id' => $zone->id,
            'name' => $updatedName,
            'description' => 'Updated description',
            'delivery_fee' => '25.75',
            'sort_order' => 2,
        ]);
    }

    public function test_admin_can_disable_and_re_enable_delivery_zone(): void
    {
        $zone = DeliveryZone::create([
            'name' => $this->uniqueZoneName('Toggle'),
            'delivery_fee' => 10,
            'is_active' => true,
        ]);

        $disableResponse = $this->patchJson(
            "/api/admin/delivery-zones/{$zone->id}",
            ['is_active' => false]
        );

        $disableResponse->assertOk();

        $this->assertDatabaseHas('delivery_zones', [
            'id' => $zone->id,
            'is_active' => 0,
        ]);

        $enableResponse = $this->patchJson(
            "/api/admin/delivery-zones/{$zone->id}",
            ['is_active' => true]
        );

        $enableResponse->assertOk();

        $this->assertDatabaseHas('delivery_zones', [
            'id' => $zone->id,
            'is_active' => 1,
        ]);
    }

    public function test_deleting_delivery_zone_preserves_historical_order_snapshots(): void
    {
        $zone = DeliveryZone::create([
            'name' => $this->uniqueZoneName('Historical'),
            'delivery_fee' => 14.50,
            'is_active' => true,
        ]);

        $order = Order::create([
            'order_number' => 'BF-ZONE-' . Str::upper(Str::random(8)),
            'customer_name' => 'Historical Test Customer',
            'customer_phone' => '024' . random_int(1000000, 9999999),
            'delivery_address' => 'Historical Test Address, Accra',
            'delivery_location' => $zone->name,
            'delivery_zone_id' => $zone->id,
            'delivery_zone_name' => $zone->name,
            'original_delivery_fee' => 14.50,
            'delivery_fee' => 14.50,
            'source' => 'website',
            'status' => 'confirmed',
            'subtotal' => 100,
            'total' => 114.50,
            'payment_status' => 'unpaid',
        ]);

        $response = $this->deleteJson(
            "/api/admin/delivery-zones/{$zone->id}"
        );

        $response->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('delivery_zones', [
            'id' => $zone->id,
        ]);

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'delivery_zone_id' => null,
            'delivery_zone_name' => $zone->name,
            'original_delivery_fee' => '14.50',
            'delivery_fee' => '14.50',
        ]);
    }

    public function test_unauthenticated_user_cannot_manage_delivery_zones(): void
    {
        $this->app['auth']->forgetGuards();

        $response = $this->getJson('/api/admin/delivery-zones');

        $response->assertUnauthorized();
    }
}