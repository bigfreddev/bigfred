<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class CreateAdminUser extends Command
{
    protected $signature = 'bigfred:create-admin';

    protected $description = 'Create a BigFred administrator account';

    public function handle(): int
    {
        $name = $this->ask('Enter administrator name');
        $email = $this->ask('Enter administrator email');

        $validator = Validator::make(
            [
                'name' => $name,
                'email' => $email,
            ],
            [
                'name' => 'required|string|max:255',
                'email' => 'required|email|max:255',
            ]
        );

        if ($validator->fails()) {
            $this->error($validator->errors()->first());
            return self::FAILURE;
        }

        if (User::where('email', $email)->exists()) {
            $this->error('A user with this email already exists.');
            return self::FAILURE;
        }

        $password = $this->secret('Enter administrator password');
        $confirmation = $this->secret('Confirm administrator password');

        if (!$password || strlen($password) < 12) {
            $this->error('Password must contain at least 12 characters.');
            return self::FAILURE;
        }

        if ($password !== $confirmation) {
            $this->error('Passwords do not match.');
            return self::FAILURE;
        }

        $user = new User();
        $user->name = $name;
        $user->email = $email;
        $user->password = Hash::make($password);
        $user->is_admin = true;
        $user->save();

        $this->newLine();
        $this->info('BigFred administrator created successfully!');
        $this->line('Name: ' . $user->name);
        $this->line('Email: ' . $user->email);

        return self::SUCCESS;
    }
}
